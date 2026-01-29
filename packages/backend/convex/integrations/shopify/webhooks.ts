import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import type {
	ShopifyWebhookErrorResponse,
	ShopifyWebhookOrder,
	ShopifyWebhookProduct,
	ShopifyWebhookResponse,
	ShopifyWebhooksListResponse,
} from "./types";
import { WEBHOOK_TOPICS } from "./utils";

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

export const registerWebhooks = internalAction({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{ success: boolean; webhookIds: string[]; errors: string[] }> => {
		const connection = await ctx.runQuery(
			internal.integrations.shopify.queries.getConnectionForWebhooks,
			{
				businessId: args.businessId,
			},
		);

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
				await ctx.runMutation(internal.integrations.shopify.mutations.updateWebhookIds, {
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

export const handleWebhook = internalAction({
	args: {
		topic: v.string(),
		shop: v.string(),
		data: v.any(),
	},
	handler: async (ctx, args): Promise<void> => {
		const connection = await ctx.runQuery(
			internal.integrations.shopify.queries.getConnectionByShop,
			{
				shop: args.shop,
			},
		);

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
							await ctx.runMutation(
								internal.integrations.shopify.mutations.markProductsUnavailable,
								{
									businessId,
									shopifyProductId: `gid://shopify/Product/${product.id}`,
								},
							);
						}
						return;
					}

					const shopifyProductId = `gid://shopify/Product/${product.id}`;
					const imageUrl = product.images[0]?.src ?? null;

					const business = await ctx.runQuery(
						internal.integrations.shopify.queries.getBusinessLanguage,
						{
							businessId,
						},
					);

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
							await ctx.runMutation(internal.integrations.shopify.mutations.upsertProduct, {
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
					await ctx.runMutation(internal.integrations.shopify.mutations.markProductsUnavailable, {
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
						? await ctx.runQuery(
								internal.integrations.shopify.queries.getOrderByShopifyDraftOrderId,
								{
									shopifyDraftOrderId,
								},
							)
						: null;

					if (!echoOrderData) {
						return;
					}

					const { order: echoOrder, conversation } = echoOrderData;

					await ctx.runMutation(
						internal.integrations.shopify.mutations.updateOrderFromShopifyPayment,
						{
							orderId: echoOrder._id,
							shopifyOrderId,
							shopifyOrderNumber,
							financialStatus,
						},
					);

					if (financialStatus === "paid" && conversation) {
						await ctx.runAction(internal.integrations.shopify.orders.sendPaymentConfirmation, {
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
