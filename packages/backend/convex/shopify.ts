import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import type { Id } from "./_generated/dataModel";

function normalizeShopUrl(shop: string): string | null {
  const trimmed = shop.trim().toLowerCase();

  if (trimmed.endsWith(".myshopify.com")) {
    // ^([a-z0-9-]+)\.myshopify\.com$ matches store-name.myshopify.com format
    const match = trimmed.match(/^([a-z0-9-]+)\.myshopify\.com$/);
    if (match) {
      return trimmed;
    }
    return null;
  }

  // ^[a-z0-9-]+$ validates store name contains only lowercase letters, numbers, hyphens
  const storeNameMatch = trimmed.match(/^[a-z0-9-]+$/);
  if (storeNameMatch) {
    return `${trimmed}.myshopify.com`;
  }

  return null;
}

function generateStateParameter(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const getAuthUrl = mutation({
  args: {
    businessId: v.id("businesses"),
    shop: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw new Error("Business not found");
    }
    if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to access this business");
    }

    const normalizedShop = normalizeShopUrl(args.shop);
    if (!normalizedShop) {
      throw new Error(
        "Invalid shop URL. Must be a valid Shopify store (e.g., mystore or mystore.myshopify.com)"
      );
    }

    const existingConnection = await ctx.db
      .query("shopifyConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();
    if (existingConnection) {
      throw new Error("This business already has a Shopify connection");
    }

    const clientId = process.env.SHOPIFY_API_KEY;
    const scopes =
      process.env.SHOPIFY_SCOPES ?? "read_products,write_orders,read_orders";
    const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL;

    if (!clientId) {
      throw new Error("Shopify API key not configured");
    }
    if (!siteUrl) {
      throw new Error("Site URL not configured");
    }

    const state = generateStateParameter();

    // State format: {randomState}|{businessId} - used in callback to verify CSRF and lookup business
    const stateData = `${state}|${args.businessId}`;

    const redirectUri = `${siteUrl}/shopify/callback`;
    const authUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", stateData);

    return {
      authUrl: authUrl.toString(),
      shop: normalizedShop,
    };
  },
});

type ShopifyTokenResponse = {
  access_token: string;
  scope: string;
};

type ShopifyErrorResponse = {
  error?: string;
  error_description?: string;
};

export const handleCallback = action({
  args: {
    code: v.string(),
    shop: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; businessId?: string }> => {
    // State format: {randomState}|{businessId}
    const stateParts = args.state.split("|");
    if (stateParts.length !== 2) {
      return { success: false, error: "Invalid state parameter" };
    }

    const [, businessIdStr] = stateParts;
    const businessId = businessIdStr as Id<"businesses">;

    const normalizedShop = normalizeShopUrl(args.shop);
    if (!normalizedShop) {
      return { success: false, error: "Invalid shop URL" };
    }

    const clientId = process.env.SHOPIFY_API_KEY;
    const clientSecret = process.env.SHOPIFY_API_SECRET;

    if (!clientId || !clientSecret) {
      return { success: false, error: "Shopify credentials not configured" };
    }

    try {
      const tokenResponse = await fetch(
        `https://${normalizedShop}/admin/oauth/access_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: args.code,
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorData = (await tokenResponse.json()) as ShopifyErrorResponse;
        const errorMessage =
          errorData.error_description || errorData.error || "Token exchange failed";
        return { success: false, error: errorMessage };
      }

      const tokenData = (await tokenResponse.json()) as ShopifyTokenResponse;
      const scopes = tokenData.scope.split(",").map((s) => s.trim());

      await ctx.runMutation(internal.shopify.saveConnection, {
        businessId,
        shop: normalizedShop,
        accessToken: tokenData.access_token,
        scopes,
      });

      return { success: true, businessId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  },
});

export const saveConnection = internalMutation({
  args: {
    businessId: v.id("businesses"),
    shop: v.string(),
    accessToken: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existingConnection = await ctx.db
      .query("shopifyConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (existingConnection) {
      await ctx.db.patch(existingConnection._id, {
        shop: args.shop,
        accessToken: args.accessToken,
        scopes: args.scopes,
      });
      return existingConnection._id;
    }

    const connectionId = await ctx.db.insert("shopifyConnections", {
      businessId: args.businessId,
      shop: args.shop,
      accessToken: args.accessToken,
      scopes: args.scopes,
      createdAt: Date.now(),
    });

    return connectionId;
  },
});

type ShopifyGraphQLResponse = {
  data?: {
    products: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          descriptionHtml: string;
          status: string;
          images: {
            edges: Array<{
              node: {
                url: string;
              };
            }>;
          };
          variants: {
            edges: Array<{
              node: {
                id: string;
                title: string;
                price: string;
                sku: string;
                inventoryQuantity: number;
              };
            }>;
          };
        };
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: Array<{ message: string }>;
};

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

// Shopify REST webhook payload types (different from GraphQL response format)
type ShopifyWebhookVariant = {
  id: number;
  title: string | null;
  price: string;
  sku: string | null;
  inventory_quantity: number;
};

type ShopifyWebhookImage = {
  id: number;
  src: string;
  position: number;
};

type ShopifyWebhookProduct = {
  id: number;
  title: string;
  body_html: string | null;
  status: "active" | "archived" | "draft";
  images: ShopifyWebhookImage[];
  variants: ShopifyWebhookVariant[];
};

const SHOPIFY_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          descriptionHtml
          status
          images(first: 1) {
            edges {
              node {
                url
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const importProducts = action({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<ImportResult> => {
    const connection = await ctx.runQuery(internal.shopify.getConnectionInternal, {
      businessId: args.businessId,
    });

    if (!connection) {
      return { imported: 0, skipped: 0, errors: ["No Shopify connection found"] };
    }

    const { shop, accessToken, business } = connection;
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    try {
      while (hasNextPage) {
        const response = await fetch(
          `https://${shop}/admin/api/2024-01/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({
              query: SHOPIFY_PRODUCTS_QUERY,
              variables: { first: 50, after: cursor },
            }),
          }
        );

        if (!response.ok) {
          errors.push(`API error: ${response.status} ${response.statusText}`);
          break;
        }

        const result = (await response.json()) as ShopifyGraphQLResponse;

        if (result.errors) {
          errors.push(...result.errors.map((e) => e.message));
          break;
        }

        if (!result.data) {
          errors.push("No data returned from Shopify");
          break;
        }

        const products = result.data.products;

        for (const edge of products.edges) {
          const product = edge.node;

          if (product.status !== "ACTIVE") {
            skipped++;
            continue;
          }

          const shopifyProductId = product.id;
          const imageUrl = product.images.edges[0]?.node.url ?? null;

          for (const variantEdge of product.variants.edges) {
            const variant = variantEdge.node;
            const isOnlyVariant = product.variants.edges.length === 1;
            const variantTitle = isOnlyVariant || variant.title === "Default Title"
              ? ""
              : variant.title;

            const name = variantTitle
              ? `${product.title} - ${variantTitle}`
              : product.title;

            // Convert price from dollars string to cents integer
            const priceInCents = Math.round(parseFloat(variant.price) * 100);
            const available = variant.inventoryQuantity > 0;

            try {
              await ctx.runMutation(internal.shopify.upsertProduct, {
                businessId: args.businessId,
                shopifyProductId,
                shopifyVariantId: variant.id,
                name,
                description: product.descriptionHtml || undefined,
                price: priceInCents,
                currency: business.defaultLanguage === "es" ? "COP" : business.defaultLanguage === "pt" ? "BRL" : "USD",
                imageUrl: imageUrl ?? undefined,
                available,
              });
              imported++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              errors.push(`Failed to import "${name}": ${msg}`);
            }
          }
        }

        hasNextPage = products.pageInfo.hasNextPage;
        cursor = products.pageInfo.endCursor;
      }

      const status = errors.length === 0 ? "success" : imported > 0 ? "partial" : "failed";
      await ctx.runMutation(internal.shopify.updateSyncStatus, {
        businessId: args.businessId,
        status,
      });

      return { imported, skipped, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.shopify.updateSyncStatus, {
        businessId: args.businessId,
        status: "failed",
      });
      return { imported, skipped, errors: [...errors, message] };
    }
  },
});

export const getConnectionInternal = internalQuery({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("shopifyConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return null;
    }

    return {
      shop: connection.shop,
      accessToken: connection.accessToken,
      business: {
        defaultLanguage: business.defaultLanguage,
      },
    };
  },
});

export const upsertProduct = internalMutation({
  args: {
    businessId: v.id("businesses"),
    shopifyProductId: v.string(),
    shopifyVariantId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.optional(v.string()),
    available: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_shopify_id", (q) =>
        q.eq("businessId", args.businessId).eq("shopifyProductId", args.shopifyProductId)
      )
      .filter((q) => q.eq(q.field("shopifyVariantId"), args.shopifyVariantId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        price: args.price,
        available: args.available,
        lastShopifySyncAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    const existingProducts = await ctx.db
      .query("products")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const maxOrder = existingProducts.reduce((max, p) => Math.max(max, p.order), -1);

    const productId = await ctx.db.insert("products", {
      businessId: args.businessId,
      name: args.name,
      description: args.description,
      price: args.price,
      currency: args.currency,
      available: args.available,
      deleted: false,
      order: maxOrder + 1,
      source: "shopify",
      shopifyProductId: args.shopifyProductId,
      shopifyVariantId: args.shopifyVariantId,
      lastShopifySyncAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return productId;
  },
});

export const updateSyncStatus = internalMutation({
  args: {
    businessId: v.id("businesses"),
    status: v.union(v.literal("success"), v.literal("partial"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("shopifyConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (connection) {
      await ctx.db.patch(connection._id, {
        lastSyncAt: Date.now(),
        lastSyncStatus: args.status,
      });
    }
  },
});

export const markProductsUnavailable = internalMutation({
  args: {
    businessId: v.id("businesses"),
    shopifyProductId: v.string(),
  },
  handler: async (ctx, args): Promise<number> => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_shopify_id", (q) =>
        q.eq("businessId", args.businessId).eq("shopifyProductId", args.shopifyProductId)
      )
      .collect();

    const now = Date.now();
    let count = 0;

    for (const product of products) {
      await ctx.db.patch(product._id, {
        available: false,
        lastShopifySyncAt: now,
        updatedAt: now,
      });
      count++;
    }

    return count;
  },
});

export const handleWebhook = internalAction({
  args: {
    topic: v.string(),
    shop: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args): Promise<void> => {
    console.log(`Processing Shopify webhook: ${args.topic} from ${args.shop}`);

    const connection = await ctx.runQuery(internal.shopify.getConnectionByShop, {
      shop: args.shop,
    });

    if (!connection) {
      console.error(`No Shopify connection found for shop: ${args.shop}`);
      return;
    }

    const { businessId } = connection;

    try {
      switch (args.topic) {
        case "products/create":
        case "products/update": {
          const product = args.data as ShopifyWebhookProduct | null;
          if (!product || !product.id || !product.variants) {
            console.error(`Invalid product data for ${args.topic}:`, args.data);
            return;
          }

          if (product.status !== "active") {
            console.log(`Skipping ${args.topic} for non-active product ${product.id} (status: ${product.status})`);
            if (args.topic === "products/update") {
              const count = await ctx.runMutation(internal.shopify.markProductsUnavailable, {
                businessId,
                shopifyProductId: `gid://shopify/Product/${product.id}`,
              });
              console.log(`Marked ${count} products as unavailable for archived/draft product ${product.id}`);
            }
            return;
          }

          const shopifyProductId = `gid://shopify/Product/${product.id}`;
          const imageUrl = product.images[0]?.src ?? null;

          const business = await ctx.runQuery(internal.shopify.getBusinessLanguage, {
            businessId,
          });

          const currency = business?.defaultLanguage === "es" ? "COP" 
            : business?.defaultLanguage === "pt" ? "BRL" 
            : "USD";

          let processedCount = 0;
          for (const variant of product.variants) {
            const isOnlyVariant = product.variants.length === 1;
            const variantTitle = isOnlyVariant || variant.title === "Default Title" || !variant.title
              ? ""
              : variant.title;

            const name = variantTitle
              ? `${product.title} - ${variantTitle}`
              : product.title;

            const priceInCents = Math.round(parseFloat(variant.price) * 100);
            const available = variant.inventory_quantity > 0;

            try {
              await ctx.runMutation(internal.shopify.upsertProduct, {
                businessId,
                shopifyProductId,
                shopifyVariantId: `gid://shopify/ProductVariant/${variant.id}`,
                name,
                description: product.body_html ?? undefined,
                price: priceInCents,
                currency,
                imageUrl: imageUrl ?? undefined,
                available,
              });
              processedCount++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              console.error(`Failed to upsert variant ${variant.id} for product ${product.id}: ${msg}`);
            }
          }

          console.log(`Processed ${processedCount} variants for ${args.topic} product ${product.id}`);
          break;
        }

        case "products/delete": {
          const deleteData = args.data as { id?: number } | null;
          if (!deleteData || !deleteData.id) {
            console.error("Invalid delete data:", args.data);
            return;
          }

          const shopifyProductId = `gid://shopify/Product/${deleteData.id}`;
          const count = await ctx.runMutation(internal.shopify.markProductsUnavailable, {
            businessId,
            shopifyProductId,
          });

          console.log(`Marked ${count} products as unavailable for deleted Shopify product ${deleteData.id}`);
          break;
        }

        default:
          console.log(`Unhandled Shopify webhook topic: ${args.topic}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error processing Shopify webhook ${args.topic}: ${message}`);
    }
  },
});

export const getConnectionByShop = internalQuery({
  args: {
    shop: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("shopifyConnections")
      .withIndex("by_shop", (q) => q.eq("shop", args.shop))
      .first();

    if (!connection) {
      return null;
    }

    return {
      businessId: connection.businessId,
      accessToken: connection.accessToken,
    };
  },
});

export const getBusinessLanguage = internalQuery({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return null;
    }
    return {
      defaultLanguage: business.defaultLanguage,
    };
  },
});

export const getConnectionStatus = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return null;
    }

    const connection = await ctx.db
      .query("shopifyConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: true,
      shop: connection.shop,
      lastSyncAt: connection.lastSyncAt ?? null,
      lastSyncStatus: connection.lastSyncStatus ?? null,
      scopes: connection.scopes,
    };
  },
});
