import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action, internalMutation, internalQuery, mutation } from "../_generated/server";
import { requireBusinessOwnership } from "../lib/auth";
import type { OrderItem } from "./types";

export const updatePaymentLink = mutation({
	args: {
		orderId: v.id("orders"),
		stripeSessionId: v.string(),
		paymentLinkUrl: v.string(),
		paymentLinkExpiresAt: v.number(),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);

		await ctx.db.patch(args.orderId, {
			stripeSessionId: args.stripeSessionId,
			paymentLinkUrl: args.paymentLinkUrl,
			paymentLinkExpiresAt: args.paymentLinkExpiresAt,
			updatedAt: Date.now(),
		});
	},
});

export const generatePaymentLink = action({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args): Promise<string> => {
		const order = await ctx.runQuery(internal.orders.payments.getOrderForPayment, {
			orderId: args.orderId,
		});

		if (!order) {
			throw new Error("Order not found");
		}

		if (order.items.length === 0) {
			throw new Error("Order has no items");
		}

		const now = Date.now();
		const isExpired = order.paymentLinkExpiresAt && order.paymentLinkExpiresAt < now;
		if (order.status !== "draft" && !isExpired) {
			throw new Error("Payment link can only be generated for draft orders or expired links");
		}

		const shopifyConnection = await ctx.runQuery(
			internal.orders.payments.getShopifyConnectionForOrder,
			{
				businessId: order.businessId,
			},
		);

		if (shopifyConnection) {
			try {
				const result = await ctx.runAction(api.integrations.shopify.orders.createOrder, {
					orderId: args.orderId,
				});

				if (result.success && result.invoiceUrl) {
					console.log(
						`[Shopify] Draft order created successfully for order ${order.orderNumber}: ${result.shopifyDraftOrderId}`,
					);
					return result.invoiceUrl;
				}

				console.error(
					`[Shopify] Draft order creation failed for order ${order.orderNumber}: ${result.error}. Falling back to Stripe.`,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error";
				console.error(
					`[Shopify] Draft order creation threw error for order ${order.orderNumber}: ${message}. Falling back to Stripe.`,
				);
			}
		}

		const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
		if (!stripeSecretKey) {
			throw new Error("No payment provider configured. Please connect Shopify or set up Stripe.");
		}

		const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";

		const params: Record<string, string> = {
			mode: "payment",
			"metadata[orderId]": args.orderId,
			success_url: `${baseUrl}/orders/${args.orderId}?payment=success`,
			cancel_url: `${baseUrl}/orders/${args.orderId}?payment=cancelled`,
		};

		order.items.forEach((item: OrderItem, idx: number) => {
			params[`line_items[${idx}][price_data][currency]`] = order.currency.toLowerCase();
			params[`line_items[${idx}][price_data][product_data][name]`] = item.name;
			params[`line_items[${idx}][price_data][unit_amount]`] = item.unitPrice.toString();
			params[`line_items[${idx}][quantity]`] = item.quantity.toString();
		});

		const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${stripeSecretKey}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams(params),
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = "Failed to create payment session";
			try {
				const errorData = JSON.parse(errorText);
				if (errorData.error?.message) {
					errorMessage = errorData.error.message;
				}
			} catch {
				errorMessage = errorText || errorMessage;
			}
			throw new Error(`Stripe error: ${errorMessage}`);
		}

		const session = (await response.json()) as {
			id: string;
			url: string;
		};

		if (!session.url) {
			throw new Error("Stripe did not return a checkout URL");
		}

		const expiresAt = now + 24 * 60 * 60 * 1000;

		await ctx.runMutation(internal.orders.payments.updatePaymentLinkInternal, {
			orderId: args.orderId,
			stripeSessionId: session.id,
			paymentLinkUrl: session.url,
			paymentLinkExpiresAt: expiresAt,
			paymentProvider: "stripe",
		});

		return session.url;
	},
});

export const getOrderForPayment = internalQuery({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.orderId);
	},
});

export const getShopifyConnectionForOrder = internalQuery({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();
	},
});

export const updatePaymentLinkInternal = internalMutation({
	args: {
		orderId: v.id("orders"),
		stripeSessionId: v.string(),
		paymentLinkUrl: v.string(),
		paymentLinkExpiresAt: v.number(),
		paymentProvider: v.optional(
			v.union(v.literal("stripe"), v.literal("shopify"), v.literal("cash")),
		),
	},
	handler: async (ctx, args) => {
		const updates: Record<string, unknown> = {
			stripeSessionId: args.stripeSessionId,
			paymentLinkUrl: args.paymentLinkUrl,
			paymentLinkExpiresAt: args.paymentLinkExpiresAt,
			updatedAt: Date.now(),
		};
		if (args.paymentProvider) {
			updates.paymentProvider = args.paymentProvider;
		}
		await ctx.db.patch(args.orderId, updates);
	},
});

export const updateOrderPaymentStatus = internalMutation({
	args: {
		stripeSessionId: v.string(),
		status: v.optional(
			v.union(
				v.literal("draft"),
				v.literal("confirmed"),
				v.literal("paid"),
				v.literal("preparing"),
				v.literal("ready"),
				v.literal("delivered"),
				v.literal("cancelled"),
			),
		),
		paymentStatus: v.optional(
			v.union(v.literal("pending"), v.literal("paid"), v.literal("failed"), v.literal("refunded")),
		),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db
			.query("orders")
			.withIndex("by_payment_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
			.first();

		if (!order) {
			return;
		}

		const updates: Record<string, unknown> = {
			updatedAt: Date.now(),
		};

		if (args.status) {
			updates.status = args.status;
		}
		if (args.paymentStatus) {
			updates.paymentStatus = args.paymentStatus;
		}

		await ctx.db.patch(order._id, updates);

		if (args.status === "paid" && !order.shopifyOrderId) {
			const shopifyConnection = await ctx.db
				.query("shopifyConnections")
				.withIndex("by_business", (q) => q.eq("businessId", order.businessId))
				.first();

			if (shopifyConnection) {
				ctx.scheduler.runAfter(0, internal.orders.shopify.triggerShopifyOrderCreation, {
					orderId: order._id,
				});
			}
		}
	},
});
