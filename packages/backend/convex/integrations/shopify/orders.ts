import type { GenericActionCtx } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "../../_generated/api";
import type { DataModel } from "../../_generated/dataModel";
import { action, internalAction } from "../../_generated/server";
import { getAuthUser } from "../../lib/auth";
import type {
	CreateDraftOrderResult,
	ShopifyDraftOrderResponse,
	ShopifyOrderErrorResponse,
	ShopifyOrderResponse,
} from "./types";

export const createOrder = action({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args): Promise<CreateDraftOrderResult> => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: "Not authenticated",
			};
		}

		const orderData = await ctx.runQuery(internal.integrations.shopify.queries.getOrderForShopify, {
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

		const authResult = await ctx.runQuery(
			internal.integrations.shopify.queries.verifyBusinessOwnership,
			{
				businessId: order.businessId,
			},
		);

		if (!authResult.authorized) {
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: authResult.error ?? "Not authorized",
			};
		}

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
				`https://${shopifyConnection.shop}/admin/api/2026-01/draft_orders.json`,
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

			await ctx.runMutation(internal.integrations.shopify.mutations.updateOrderWithDraftOrderInfo, {
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

async function createRegularOrder(
	ctx: GenericActionCtx<DataModel>,
	orderId: string,
	order: {
		orderNumber: string;
		items: Array<{ productId: string; name: string; quantity: number }>;
		notes?: string;
		contactName?: string;
		contactPhone: string;
		deliveryType: "delivery" | "pickup";
		deliveryAddress?: string;
		total: number;
		paymentMethod: string;
	},
	products: Array<{ _id: string; shopifyVariantId?: string }>,
	shopifyConnection: { shop: string; accessToken: string },
): Promise<CreateDraftOrderResult> {
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
		console.error(
			`[Shopify] No valid line items for order ${order.orderNumber}: ${skippedItems.join(", ")}`,
		);
		return {
			success: false,
			shopifyDraftOrderId: null,
			shopifyOrderNumber: null,
			invoiceUrl: null,
			error: `No Shopify products to order. Skipped: ${skippedItems.join(", ")}`,
		};
	}

	const orderPayload: Record<string, unknown> = {
		order: {
			line_items: lineItems,
			note: order.notes ?? `Echo Order: ${order.orderNumber}`,
			tags: `echo,${order.orderNumber}`,
			financial_status: "paid",
			send_receipt: false,
			send_fulfillment_receipt: false,
			transactions: [
				{
					kind: "sale",
					status: "success",
					amount: (order.total / 100).toFixed(2),
				},
			],
		},
	};

	if (order.contactName || order.contactPhone) {
		(orderPayload.order as Record<string, unknown>).customer = {
			first_name: order.contactName ?? "Customer",
			phone: order.contactPhone,
		};
	}

	if (order.deliveryType === "delivery" && order.deliveryAddress) {
		(orderPayload.order as Record<string, unknown>).shipping_address = {
			address1: order.deliveryAddress,
			phone: order.contactPhone,
		};
	}

	try {
		const response = await fetch(
			`https://${shopifyConnection.shop}/admin/api/2026-01/orders.json`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Shopify-Access-Token": shopifyConnection.accessToken,
				},
				body: JSON.stringify(orderPayload),
			},
		);

		if (!response.ok) {
			const errorData = (await response.json()) as ShopifyOrderErrorResponse;
			const errorMessage =
				typeof errorData.errors === "string" ? errorData.errors : JSON.stringify(errorData.errors);
			console.error(
				`[Shopify] Regular order creation failed: ${response.status} - ${errorMessage}`,
			);
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: `Shopify API error: ${errorMessage}`,
			};
		}

		const data = (await response.json()) as ShopifyOrderResponse;
		const shopifyOrderId = String(data.order.id);
		const shopifyOrderNumber = data.order.name;

		await ctx.runMutation(internal.integrations.shopify.mutations.updateOrderWithShopifyInfo, {
			orderId: orderId as any,
			shopifyOrderId,
			shopifyOrderNumber,
		});

		console.log(
			`[Shopify] Successfully created regular order ${shopifyOrderNumber} (ID: ${shopifyOrderId}) for Echo order ${order.orderNumber}`,
		);

		if (skippedItems.length > 0) {
			console.warn(
				`[Shopify] Skipped items for Echo order ${order.orderNumber}: ${skippedItems.join(", ")}`,
			);
		}

		return {
			success: true,
			shopifyDraftOrderId: null,
			shopifyOrderNumber,
			invoiceUrl: null,
			error: skippedItems.length > 0 ? `Skipped items: ${skippedItems.join(", ")}` : null,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(
			`[Shopify] Regular order creation failed for Echo order ${order.orderNumber}: ${message}`,
		);
		return {
			success: false,
			shopifyDraftOrderId: null,
			shopifyOrderNumber: null,
			invoiceUrl: null,
			error: message,
		};
	}
}

export const createOrderInternal = internalAction({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args): Promise<CreateDraftOrderResult> => {
		console.log(`[Shopify] Starting order creation for ${args.orderId}`);

		const orderData = await ctx.runQuery(internal.integrations.shopify.queries.getOrderForShopify, {
			orderId: args.orderId,
		});

		if (!orderData) {
			console.error(`[Shopify] Order not found: ${args.orderId}`);
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
			console.error(`[Shopify] No connection found for business ${order.businessId}`);
			return {
				success: false,
				shopifyDraftOrderId: null,
				shopifyOrderNumber: null,
				invoiceUrl: null,
				error: "No Shopify connection found for this business",
			};
		}

		// For cash payments, create a regular Shopify order (not a draft)
		if (order.paymentMethod === "cash") {
			console.log(`[Shopify] Creating regular order for cash payment: ${order.orderNumber}`);
			return await createRegularOrder(ctx, args.orderId, order, products, shopifyConnection);
		}

		// For card payments, create a draft order (existing behavior)
		console.log(`[Shopify] Creating draft order for card payment: ${order.orderNumber}`);

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
				`https://${shopifyConnection.shop}/admin/api/2026-01/draft_orders.json`,
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

			await ctx.runMutation(internal.integrations.shopify.mutations.updateOrderWithDraftOrderInfo, {
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

export const sendPaymentConfirmation = internalAction({
	args: {
		conversationId: v.id("conversations"),
		orderNumber: v.string(),
		shopifyOrderNumber: v.string(),
	},
	handler: async (ctx, args) => {
		try {
			const conversation = await ctx.runQuery(
				internal.integrations.shopify.queries.getConversationForConfirmation,
				{
					conversationId: args.conversationId,
				},
			);

			if (!conversation) {
				console.error(`Conversation not found for payment confirmation: ${args.conversationId}`);
				return;
			}

			const confirmationMessage = `Thank you for your payment! Your order ${args.orderNumber} has been confirmed. Shopify order reference: ${args.shopifyOrderNumber}. We'll start preparing it right away!`;

			await ctx.runMutation(internal.integrations.shopify.mutations.saveAiMessage, {
				conversationId: args.conversationId,
				content: confirmationMessage,
			});

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
