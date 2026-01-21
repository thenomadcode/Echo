import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
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
