import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { authComponent } from "./auth";

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
				"Invalid shop URL. Must be a valid Shopify store (e.g., mystore or mystore.myshopify.com)",
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
		const scopes = process.env.SHOPIFY_SCOPES ?? "read_products,write_orders,read_orders";
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
	handler: async (
		ctx,
		args,
	): Promise<{ success: boolean; error?: string; businessId?: string }> => {
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
			const tokenResponse = await fetch(`https://${normalizedShop}/admin/oauth/access_token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					client_id: clientId,
					client_secret: clientSecret,
					code: args.code,
				}),
			});

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

			const webhookResult = await ctx.runAction(internal.shopify.registerWebhooks, {
				businessId,
			});

			if (!webhookResult.success) {
				console.warn(`Webhook registration had issues: ${webhookResult.errors.join(", ")}`);
			}

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
				const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Shopify-Access-Token": accessToken,
					},
					body: JSON.stringify({
						query: SHOPIFY_PRODUCTS_QUERY,
						variables: { first: 50, after: cursor },
					}),
				});

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
						const variantTitle =
							isOnlyVariant || variant.title === "Default Title" ? "" : variant.title;

						const name = variantTitle ? `${product.title} - ${variantTitle}` : product.title;

						// Convert price from dollars string to cents integer
						const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
						const available = variant.inventoryQuantity > 0;

						try {
							await ctx.runMutation(internal.shopify.upsertProduct, {
								businessId: args.businessId,
								shopifyProductId,
								shopifyVariantId: variant.id,
								name,
								description: product.descriptionHtml || undefined,
								price: priceInCents,
								currency:
									business.defaultLanguage === "es"
										? "COP"
										: business.defaultLanguage === "pt"
											? "BRL"
											: "USD",
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
				q.eq("businessId", args.businessId).eq("shopifyProductId", args.shopifyProductId),
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
				q.eq("businessId", args.businessId).eq("shopifyProductId", args.shopifyProductId),
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
						if (args.topic === "products/update") {
							const _count = await ctx.runMutation(internal.shopify.markProductsUnavailable, {
								businessId,
								shopifyProductId: `gid://shopify/Product/${product.id}`,
							});
						}
						return;
					}

					const shopifyProductId = `gid://shopify/Product/${product.id}`;
					const imageUrl = product.images[0]?.src ?? null;

					const business = await ctx.runQuery(internal.shopify.getBusinessLanguage, {
						businessId,
					});

					const currency =
						business?.defaultLanguage === "es"
							? "COP"
							: business?.defaultLanguage === "pt"
								? "BRL"
								: "USD";

					let _processedCount = 0;
					for (const variant of product.variants) {
						const isOnlyVariant = product.variants.length === 1;
						const variantTitle =
							isOnlyVariant || variant.title === "Default Title" || !variant.title
								? ""
								: variant.title;

						const name = variantTitle ? `${product.title} - ${variantTitle}` : product.title;

						const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
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
							_processedCount++;
						} catch (err) {
							const msg = err instanceof Error ? err.message : "Unknown error";
							console.error(
								`Failed to upsert variant ${variant.id} for product ${product.id}: ${msg}`,
							);
						}
					}
					break;
				}

				case "products/delete": {
					const deleteData = args.data as { id?: number } | null;
					if (!deleteData || !deleteData.id) {
						console.error("Invalid delete data:", args.data);
						return;
					}

					const shopifyProductId = `gid://shopify/Product/${deleteData.id}`;
					const _count = await ctx.runMutation(internal.shopify.markProductsUnavailable, {
						businessId,
						shopifyProductId,
					});
					break;
				}

				case "orders/paid": {
					const orderData = args.data as ShopifyWebhookOrder | null;
					if (!orderData || !orderData.id) {
						console.error("Invalid order data for orders/paid:", args.data);
						return;
					}

					const shopifyOrderId = String(orderData.id);
					const shopifyOrderNumber = orderData.name;
					const financialStatus = orderData.financial_status;

					if (financialStatus !== "paid" && financialStatus !== "partially_paid") {
						return;
					}

					const shopifyDraftOrderId = orderData.draft_order_id
						? String(orderData.draft_order_id)
						: null;

					if (!shopifyDraftOrderId) {
						const echoOrderNumber = orderData.tags
							?.split(",")
							.map((t) => t.trim())
							.find((t) => t.startsWith("ECH-"));

						if (!echoOrderNumber) {
							return;
						}
					}

					const echoOrderData = shopifyDraftOrderId
						? await ctx.runQuery(internal.shopify.getOrderByShopifyDraftOrderId, {
								shopifyDraftOrderId,
							})
						: null;

					if (!echoOrderData) {
						return;
					}

					const { order: echoOrder, conversation } = echoOrderData;

					await ctx.runMutation(internal.shopify.updateOrderFromShopifyPayment, {
						orderId: echoOrder._id,
						shopifyOrderId,
						shopifyOrderNumber,
						financialStatus,
					});

					if (financialStatus === "paid" && conversation) {
						await ctx.runAction(internal.shopify.sendPaymentConfirmation, {
							conversationId: conversation._id,
							orderNumber: echoOrder.orderNumber,
							shopifyOrderNumber,
						});
					}

					break;
				}

				default:
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

type ShopifyWebhookResponse = {
	webhook: {
		id: number;
		address: string;
		topic: string;
		created_at: string;
		updated_at: string;
		format: string;
		fields: string[];
		metafield_namespaces: string[];
		api_version: string;
		private_metafield_namespaces: string[];
	};
};

type ShopifyWebhooksListResponse = {
	webhooks: Array<{
		id: number;
		address: string;
		topic: string;
	}>;
};

type ShopifyWebhookErrorResponse = {
	errors?: Record<string, string[]> | string;
};

const WEBHOOK_TOPICS = [
	"products/create",
	"products/update",
	"products/delete",
	"orders/paid",
] as const;

export const registerWebhooks = internalAction({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{ success: boolean; webhookIds: string[]; errors: string[] }> => {
		const connection = await ctx.runQuery(internal.shopify.getConnectionForWebhooks, {
			businessId: args.businessId,
		});

		if (!connection) {
			return { success: false, webhookIds: [], errors: ["No Shopify connection found"] };
		}

		const { shop, accessToken } = connection;
		const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL;

		if (!siteUrl) {
			return { success: false, webhookIds: [], errors: ["Site URL not configured"] };
		}

		const webhookAddress = `${siteUrl}/webhook/shopify`;
		const webhookIds: string[] = [];
		const errors: string[] = [];

		try {
			const existingWebhooks = await listExistingWebhooks(shop, accessToken);
			const existingTopics = new Map<string, number>();

			for (const webhook of existingWebhooks) {
				if (webhook.address === webhookAddress) {
					existingTopics.set(webhook.topic, webhook.id);
				}
			}

			for (const topic of WEBHOOK_TOPICS) {
				if (existingTopics.has(topic)) {
					const existingId = existingTopics.get(topic);
					webhookIds.push(String(existingId));
					continue;
				}

				try {
					const webhookId = await registerSingleWebhook(shop, accessToken, topic, webhookAddress);
					webhookIds.push(String(webhookId));
				} catch (err) {
					const msg = err instanceof Error ? err.message : "Unknown error";
					errors.push(`Failed to register webhook for ${topic}: ${msg}`);
					console.error(`Failed to register webhook for ${topic}:`, err);
				}
			}

			if (webhookIds.length > 0) {
				await ctx.runMutation(internal.shopify.updateWebhookIds, {
					businessId: args.businessId,
					webhookIds,
				});
			}

			const success = webhookIds.length === WEBHOOK_TOPICS.length;
			return { success, webhookIds, errors };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return { success: false, webhookIds, errors: [...errors, message] };
		}
	},
});

async function listExistingWebhooks(
	shop: string,
	accessToken: string,
): Promise<Array<{ id: number; topic: string; address: string }>> {
	const response = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
		method: "GET",
		headers: {
			"X-Shopify-Access-Token": accessToken,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		console.error(`Failed to list webhooks: ${response.status} ${response.statusText}`);
		return [];
	}

	const data = (await response.json()) as ShopifyWebhooksListResponse;
	return data.webhooks ?? [];
}

async function registerSingleWebhook(
	shop: string,
	accessToken: string,
	topic: string,
	address: string,
): Promise<number> {
	const response = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
		method: "POST",
		headers: {
			"X-Shopify-Access-Token": accessToken,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			webhook: {
				topic,
				address,
				format: "json",
			},
		}),
	});

	if (!response.ok) {
		const errorData = (await response.json()) as ShopifyWebhookErrorResponse;
		const errorMessage =
			typeof errorData.errors === "string" ? errorData.errors : JSON.stringify(errorData.errors);
		throw new Error(`Shopify API error ${response.status}: ${errorMessage}`);
	}

	const data = (await response.json()) as ShopifyWebhookResponse;
	return data.webhook.id;
}

export const getConnectionForWebhooks = internalQuery({
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

		return {
			shop: connection.shop,
			accessToken: connection.accessToken,
		};
	},
});

export const updateWebhookIds = internalMutation({
	args: {
		businessId: v.id("businesses"),
		webhookIds: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (connection) {
			await ctx.db.patch(connection._id, {
				webhookIds: args.webhookIds,
			});
		}
	},
});

type SyncResult = {
	updated: number;
	added: number;
	removed: number;
	errors: string[];
};

export const syncProducts = action({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<SyncResult> => {
		const authResult = await ctx.runQuery(internal.shopify.verifyBusinessOwnership, {
			businessId: args.businessId,
		});

		if (!authResult.authorized) {
			return { updated: 0, added: 0, removed: 0, errors: [authResult.error ?? "Not authorized"] };
		}

		const connection = await ctx.runQuery(internal.shopify.getConnectionInternal, {
			businessId: args.businessId,
		});

		if (!connection) {
			return { updated: 0, added: 0, removed: 0, errors: ["No Shopify connection found"] };
		}

		const { shop, accessToken, business } = connection;
		let updated = 0;
		let added = 0;
		let removed = 0;
		const errors: string[] = [];
		const seenShopifyVariantIds = new Set<string>();

		let hasNextPage = true;
		let cursor: string | null = null;

		try {
			while (hasNextPage) {
				const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Shopify-Access-Token": accessToken,
					},
					body: JSON.stringify({
						query: SHOPIFY_PRODUCTS_QUERY,
						variables: { first: 50, after: cursor },
					}),
				});

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
						for (const variantEdge of product.variants.edges) {
							seenShopifyVariantIds.add(variantEdge.node.id);
						}
						continue;
					}

					const shopifyProductId = product.id;
					const imageUrl = product.images.edges[0]?.node.url ?? null;

					for (const variantEdge of product.variants.edges) {
						const variant = variantEdge.node;
						seenShopifyVariantIds.add(variant.id);

						const isOnlyVariant = product.variants.edges.length === 1;
						const variantTitle =
							isOnlyVariant || variant.title === "Default Title" ? "" : variant.title;

						const name = variantTitle ? `${product.title} - ${variantTitle}` : product.title;

						const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
						const available = variant.inventoryQuantity > 0;

						try {
							const syncResult = await ctx.runMutation(internal.shopify.upsertProductWithStats, {
								businessId: args.businessId,
								shopifyProductId,
								shopifyVariantId: variant.id,
								name,
								description: product.descriptionHtml || undefined,
								price: priceInCents,
								currency:
									business.defaultLanguage === "es"
										? "COP"
										: business.defaultLanguage === "pt"
											? "BRL"
											: "USD",
								imageUrl: imageUrl ?? undefined,
								available,
							});

							if (syncResult.isNew) {
								added++;
							} else {
								updated++;
							}
						} catch (err) {
							const msg = err instanceof Error ? err.message : "Unknown error";
							errors.push(`Failed to sync "${name}": ${msg}`);
						}
					}
				}

				hasNextPage = products.pageInfo.hasNextPage;
				cursor = products.pageInfo.endCursor;
			}

			const removedCount = await ctx.runMutation(internal.shopify.markMissingProductsUnavailable, {
				businessId: args.businessId,
				seenShopifyVariantIds: Array.from(seenShopifyVariantIds),
			});
			removed = removedCount;

			const status =
				errors.length === 0 ? "success" : updated + added + removed > 0 ? "partial" : "failed";
			await ctx.runMutation(internal.shopify.updateSyncStatus, {
				businessId: args.businessId,
				status,
			});

			return { updated, added, removed, errors };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			await ctx.runMutation(internal.shopify.updateSyncStatus, {
				businessId: args.businessId,
				status: "failed",
			});
			return { updated, added, removed, errors: [...errors, message] };
		}
	},
});

export const verifyBusinessOwnership = internalQuery({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<{ authorized: boolean; error?: string }> => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			return { authorized: false, error: "Not authenticated" };
		}

		const business = await ctx.db.get(args.businessId);
		if (!business) {
			return { authorized: false, error: "Business not found" };
		}

		if (business.ownerId !== authUser._id) {
			return { authorized: false, error: "Not authorized to access this business" };
		}

		return { authorized: true };
	},
});

export const upsertProductWithStats = internalMutation({
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
	handler: async (ctx, args): Promise<{ isNew: boolean }> => {
		const existing = await ctx.db
			.query("products")
			.withIndex("by_shopify_id", (q) =>
				q.eq("businessId", args.businessId).eq("shopifyProductId", args.shopifyProductId),
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
			return { isNew: false };
		}

		const existingProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.collect();

		const maxOrder = existingProducts.reduce((max, p) => Math.max(max, p.order), -1);

		await ctx.db.insert("products", {
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

		return { isNew: true };
	},
});

export const markMissingProductsUnavailable = internalMutation({
	args: {
		businessId: v.id("businesses"),
		seenShopifyVariantIds: v.array(v.string()),
	},
	handler: async (ctx, args): Promise<number> => {
		const shopifyProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.filter((q) => q.and(q.eq(q.field("source"), "shopify"), q.eq(q.field("available"), true)))
			.collect();

		const seenSet = new Set(args.seenShopifyVariantIds);
		const now = Date.now();
		let count = 0;

		for (const product of shopifyProducts) {
			if (product.shopifyVariantId && !seenSet.has(product.shopifyVariantId)) {
				await ctx.db.patch(product._id, {
					available: false,
					lastShopifySyncAt: now,
					updatedAt: now,
				});
				count++;
			}
		}

		return count;
	},
});

type ShopifyDraftOrderResponse = {
	draft_order: {
		id: number;
		name: string;
		invoice_url: string;
		status: string;
		total_price: string;
		created_at: string;
	};
};

type ShopifyOrderErrorResponse = {
	errors?: Record<string, string[]> | string;
};

type CreateDraftOrderResult = {
	success: boolean;
	shopifyDraftOrderId: string | null;
	shopifyOrderNumber: string | null;
	invoiceUrl: string | null;
	error: string | null;
};

export const createOrder = action({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args): Promise<CreateDraftOrderResult> => {
		const orderData = await ctx.runQuery(internal.shopify.getOrderForShopify, {
			orderId: args.orderId,
		});

		if (!orderData) {
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: "Order not found",
			};
		}

		const { order, products, shopifyConnection } = orderData;

		if (!shopifyConnection) {
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: "No Shopify connection found for this business",
			};
		}

		const lineItems: Array<{ variant_id: number; quantity: number }> = [];
		const skippedItems: string[] = [];

		for (const item of order.items) {
			const product = products.find((p) => p._id === item.productId);
			if (!product) {
				skippedItems.push(`${item.name} (product not found)`);
				continue;
			}

			if (!product.shopifyVariantId) {
				skippedItems.push(`${item.name} (manual product, no Shopify variant)`);
				continue;
			}

			const variantIdMatch = product.shopifyVariantId.match(/\/ProductVariant\/(\d+)$/);
			if (!variantIdMatch) {
				skippedItems.push(`${item.name} (invalid Shopify variant ID format)`);
				continue;
			}

			lineItems.push({
				variant_id: Number.parseInt(variantIdMatch[1], 10),
				quantity: item.quantity,
			});
		}

		if (lineItems.length === 0) {
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: `No Shopify products to order. Skipped: ${skippedItems.join(", ")}`,
			};
		}

		const draftOrderPayload: Record<string, unknown> = {
			draft_order: {
				line_items: lineItems,
				note: order.notes ?? `Echo Order: ${order.orderNumber}`,
				tags: `echo,${order.orderNumber}`,
				use_customer_default_address: false,
			},
		};

		if (order.contactName || order.contactPhone) {
			(draftOrderPayload.draft_order as Record<string, unknown>).customer = {
				first_name: order.contactName ?? "Customer",
				phone: order.contactPhone,
			};
		}

		if (order.deliveryType === "delivery" && order.deliveryAddress) {
			(draftOrderPayload.draft_order as Record<string, unknown>).shipping_address = {
				address1: order.deliveryAddress,
				phone: order.contactPhone,
			};
		}

		try {
			const response = await fetch(
				`https://${shopifyConnection.shop}/admin/api/2024-01/draft_orders.json`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Shopify-Access-Token": shopifyConnection.accessToken,
					},
					body: JSON.stringify(draftOrderPayload),
				},
			);

			if (!response.ok) {
				const errorData = (await response.json()) as ShopifyOrderErrorResponse;
				const errorMessage =
					typeof errorData.errors === "string"
						? errorData.errors
						: JSON.stringify(errorData.errors);
				console.error(`Shopify draft order creation failed: ${response.status} - ${errorMessage}`);
				return {
					success: false,
					shopifyDraftOrderId: null,
					shopifyOrderNumber: null,
					invoiceUrl: null,
					error: `Shopify API error: ${errorMessage}`,
				};
			}

			const data = (await response.json()) as ShopifyDraftOrderResponse;
			const shopifyDraftOrderId = String(data.draft_order.id);
			const shopifyOrderNumber = data.draft_order.name;
			const invoiceUrl = data.draft_order.invoice_url;

			await ctx.runMutation(internal.shopify.updateOrderWithDraftOrderInfo, {
				orderId: args.orderId,
				shopifyDraftOrderId,
				shopifyOrderNumber,
				invoiceUrl,
			});

			if (skippedItems.length > 0) {
				console.warn(
					`Skipped items for Echo order ${order.orderNumber}: ${skippedItems.join(", ")}`,
				);
			}

			return {
				success: true,
				shopifyDraftOrderId,
				shopifyOrderNumber,
				invoiceUrl,
				error: skippedItems.length > 0 ? `Skipped items: ${skippedItems.join(", ")}` : null,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(
				`Shopify draft order creation failed for Echo order ${order.orderNumber}: ${message}`,
			);
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: message,
			};
		}
	},
});

export const getOrderForShopify = internalQuery({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			return null;
		}

		const shopifyConnection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", order.businessId))
			.first();

		const productIds = order.items.map((item) => item.productId);
		const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));

		return {
			order,
			products: products.filter((p) => p !== null),
			shopifyConnection: shopifyConnection
				? { shop: shopifyConnection.shop, accessToken: shopifyConnection.accessToken }
				: null,
		};
	},
});

export const updateOrderWithShopifyInfo = internalMutation({
	args: {
		orderId: v.id("orders"),
		shopifyOrderId: v.string(),
		shopifyOrderNumber: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.orderId, {
			shopifyOrderId: args.shopifyOrderId,
			shopifyOrderNumber: args.shopifyOrderNumber,
			paymentProvider: "shopify",
			updatedAt: Date.now(),
		});
	},
});

export const updateOrderWithDraftOrderInfo = internalMutation({
	args: {
		orderId: v.id("orders"),
		shopifyDraftOrderId: v.string(),
		shopifyOrderNumber: v.string(),
		invoiceUrl: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.orderId, {
			shopifyDraftOrderId: args.shopifyDraftOrderId,
			shopifyOrderNumber: args.shopifyOrderNumber,
			paymentLinkUrl: args.invoiceUrl,
			paymentProvider: "shopify",
			updatedAt: Date.now(),
		});
	},
});

export const disconnect = action({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		const authResult = await ctx.runQuery(internal.shopify.verifyBusinessOwnership, {
			businessId: args.businessId,
		});

		if (!authResult.authorized) {
			return { success: false, error: authResult.error ?? "Not authorized" };
		}

		const connection = await ctx.runQuery(internal.shopify.getConnectionForDisconnect, {
			businessId: args.businessId,
		});

		if (!connection) {
			return { success: false, error: "No Shopify connection found" };
		}

		const { shop, accessToken, webhookIds } = connection;

		if (webhookIds && webhookIds.length > 0) {
			for (const webhookId of webhookIds) {
				try {
					await fetch(`https://${shop}/admin/api/2024-01/webhooks/${webhookId}.json`, {
						method: "DELETE",
						headers: {
							"X-Shopify-Access-Token": accessToken,
						},
					});
				} catch (err) {
					console.warn(`Failed to delete webhook ${webhookId}:`, err);
				}
			}
		}

		try {
			await fetch(`https://${shop}/admin/api/2024-01/access_tokens/current.json`, {
				method: "DELETE",
				headers: {
					"X-Shopify-Access-Token": accessToken,
				},
			});
		} catch (err) {
			console.warn("Failed to revoke access token:", err);
		}

		await ctx.runMutation(internal.shopify.deleteConnectionAndClearProducts, {
			businessId: args.businessId,
		});

		return { success: true };
	},
});

export const getConnectionForDisconnect = internalQuery({
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

		return {
			shop: connection.shop,
			accessToken: connection.accessToken,
			webhookIds: connection.webhookIds,
		};
	},
});

export const deleteConnectionAndClearProducts = internalMutation({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (connection) {
			await ctx.db.delete(connection._id);
		}

		const shopifyProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.filter((q) => q.eq(q.field("source"), "shopify"))
			.collect();

		const now = Date.now();

		for (const product of shopifyProducts) {
			await ctx.db.patch(product._id, {
				source: "manual",
				shopifyProductId: undefined,
				shopifyVariantId: undefined,
				lastShopifySyncAt: undefined,
				updatedAt: now,
			});
		}
	},
});

export const createOrderInternal = internalAction({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args): Promise<CreateDraftOrderResult> => {
		const orderData = await ctx.runQuery(internal.shopify.getOrderForShopify, {
			orderId: args.orderId,
		});

		if (!orderData) {
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: "Order not found",
			};
		}

		const { order, products, shopifyConnection } = orderData;

		if (!shopifyConnection) {
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: "No Shopify connection found for this business",
			};
		}

		const lineItems: Array<{ variant_id: number; quantity: number }> = [];
		const skippedItems: string[] = [];

		for (const item of order.items) {
			const product = products.find((p) => p._id === item.productId);
			if (!product) {
				skippedItems.push(`${item.name} (product not found)`);
				continue;
			}

			if (!product.shopifyVariantId) {
				skippedItems.push(`${item.name} (manual product, no Shopify variant)`);
				continue;
			}

			const variantIdMatch = product.shopifyVariantId.match(/\/ProductVariant\/(\d+)$/);
			if (!variantIdMatch) {
				skippedItems.push(`${item.name} (invalid Shopify variant ID format)`);
				continue;
			}

			lineItems.push({
				variant_id: Number.parseInt(variantIdMatch[1], 10),
				quantity: item.quantity,
			});
		}

		if (lineItems.length === 0) {
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: `No Shopify products to order. Skipped: ${skippedItems.join(", ")}`,
			};
		}

		const draftOrderPayload: Record<string, unknown> = {
			draft_order: {
				line_items: lineItems,
				note: order.notes ?? `Echo Order: ${order.orderNumber}`,
				tags: `echo,${order.orderNumber}`,
				use_customer_default_address: false,
			},
		};

		if (order.contactName || order.contactPhone) {
			(draftOrderPayload.draft_order as Record<string, unknown>).customer = {
				first_name: order.contactName ?? "Customer",
				phone: order.contactPhone,
			};
		}

		if (order.deliveryType === "delivery" && order.deliveryAddress) {
			(draftOrderPayload.draft_order as Record<string, unknown>).shipping_address = {
				address1: order.deliveryAddress,
				phone: order.contactPhone,
			};
		}

		try {
			const response = await fetch(
				`https://${shopifyConnection.shop}/admin/api/2024-01/draft_orders.json`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Shopify-Access-Token": shopifyConnection.accessToken,
					},
					body: JSON.stringify(draftOrderPayload),
				},
			);

			if (!response.ok) {
				const errorData = (await response.json()) as ShopifyOrderErrorResponse;
				const errorMessage =
					typeof errorData.errors === "string"
						? errorData.errors
						: JSON.stringify(errorData.errors);
				console.error(`Shopify draft order creation failed: ${response.status} - ${errorMessage}`);
				return {
					success: false,
					shopifyDraftOrderId: null,
					shopifyOrderNumber: null,
					invoiceUrl: null,
					error: `Shopify API error: ${errorMessage}`,
				};
			}

			const data = (await response.json()) as ShopifyDraftOrderResponse;
			const shopifyDraftOrderId = String(data.draft_order.id);
			const shopifyOrderNumber = data.draft_order.name;
			const invoiceUrl = data.draft_order.invoice_url;

			await ctx.runMutation(internal.shopify.updateOrderWithDraftOrderInfo, {
				orderId: args.orderId,
				shopifyDraftOrderId,
				shopifyOrderNumber,
				invoiceUrl,
			});

			if (skippedItems.length > 0) {
				console.warn(
					`Skipped items for Echo order ${order.orderNumber}: ${skippedItems.join(", ")}`,
				);
			}

			return {
				success: true,
				shopifyDraftOrderId,
				shopifyOrderNumber,
				invoiceUrl,
				error: skippedItems.length > 0 ? `Skipped items: ${skippedItems.join(", ")}` : null,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(
				`Shopify draft order creation failed for Echo order ${order.orderNumber}: ${message}`,
			);
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: message,
			};
		}
	},
});

type ShopifyWebhookOrder = {
	id: number;
	name: string;
	financial_status:
		| "pending"
		| "paid"
		| "partially_paid"
		| "refunded"
		| "voided"
		| "partially_refunded";
	fulfillment_status: string | null;
	draft_order_id?: number;
	note?: string;
	tags?: string;
	total_price: string;
	customer?: {
		phone?: string;
		first_name?: string;
		last_name?: string;
	};
};

export const getOrderByShopifyDraftOrderId = internalQuery({
	args: {
		shopifyDraftOrderId: v.string(),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db
			.query("orders")
			.withIndex("by_shopify_draft_order", (q) =>
				q.eq("shopifyDraftOrderId", args.shopifyDraftOrderId),
			)
			.first();

		if (!order) {
			return null;
		}

		const conversation = await ctx.db.get(order.conversationId);
		const business = await ctx.db.get(order.businessId);

		return {
			order,
			conversation,
			business,
		};
	},
});

export const updateOrderFromShopifyPayment = internalMutation({
	args: {
		orderId: v.id("orders"),
		shopifyOrderId: v.string(),
		shopifyOrderNumber: v.string(),
		financialStatus: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const updates: Record<string, unknown> = {
			shopifyOrderId: args.shopifyOrderId,
			shopifyOrderNumber: args.shopifyOrderNumber,
			updatedAt: now,
		};

		if (args.financialStatus === "paid") {
			updates.status = "paid";
			updates.paymentStatus = "paid";
		} else if (args.financialStatus === "partially_paid") {
			updates.paymentStatus = "pending";
		} else if (args.financialStatus === "refunded" || args.financialStatus === "voided") {
			updates.paymentStatus = "refunded";
		}

		await ctx.db.patch(args.orderId, updates);
		return await ctx.db.get(args.orderId);
	},
});

export const sendPaymentConfirmation = internalAction({
	args: {
		conversationId: v.id("conversations"),
		orderNumber: v.string(),
		shopifyOrderNumber: v.string(),
	},
	handler: async (ctx, args) => {
		try {
			const conversation = await ctx.runQuery(internal.shopify.getConversationForConfirmation, {
				conversationId: args.conversationId,
			});

			if (!conversation) {
				console.error(`Conversation not found for payment confirmation: ${args.conversationId}`);
				return;
			}

			const confirmationMessage = `Thank you for your payment! Your order ${args.orderNumber} has been confirmed. Shopify order reference: ${args.shopifyOrderNumber}. We'll start preparing it right away!`;

			await ctx.runMutation(internal.shopify.saveAiMessage, {
				conversationId: args.conversationId,
				content: confirmationMessage,
			});

			const { api } = await import("./_generated/api");
			await ctx.runAction(api.integrations.whatsapp.actions.sendMessage, {
				conversationId: args.conversationId,
				content: confirmationMessage,
				type: "text",
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(
				`Failed to send payment confirmation for order ${args.orderNumber}: ${message}`,
			);
		}
	},
});

export const getConversationForConfirmation = internalQuery({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.conversationId);
	},
});

export const saveAiMessage = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		const messageId = await ctx.db.insert("messages", {
			conversationId: args.conversationId,
			sender: "ai",
			content: args.content,
			createdAt: Date.now(),
		});
		return messageId;
	},
});
