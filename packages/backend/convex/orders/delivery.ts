import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { requireBusinessOwnership } from "../lib/auth";

export const setDeliveryInfo = mutation({
	args: {
		orderId: v.id("orders"),
		deliveryType: v.union(v.literal("delivery"), v.literal("pickup")),
		deliveryAddress: v.optional(v.string()),
		deliveryNotes: v.optional(v.string()),
		contactPhone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);

		if (args.deliveryType === "delivery" && !args.deliveryAddress) {
			throw new Error("Delivery address is required for delivery orders");
		}

		const updates: Record<string, unknown> = {
			deliveryType: args.deliveryType,
			deliveryNotes: args.deliveryNotes,
			updatedAt: Date.now(),
		};

		if (args.deliveryType === "delivery") {
			updates.deliveryAddress = args.deliveryAddress;
		} else {
			updates.deliveryAddress = undefined;
		}

		if (args.contactPhone !== undefined) {
			updates.contactPhone = args.contactPhone;
		}

		await ctx.db.patch(args.orderId, updates);

		return args.orderId;
	},
});

export const setPaymentMethod = mutation({
	args: {
		orderId: v.id("orders"),
		paymentMethod: v.union(v.literal("card"), v.literal("cash")),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);

		const updates: Record<string, unknown> = {
			paymentMethod: args.paymentMethod,
			updatedAt: Date.now(),
		};

		if (args.paymentMethod === "cash") {
			updates.status = "confirmed";
			updates.paymentProvider = "cash";
		}

		await ctx.db.patch(args.orderId, updates);

		if (args.paymentMethod === "cash") {
			const shopifyConnection = await ctx.db
				.query("shopifyConnections")
				.withIndex("by_business", (q) => q.eq("businessId", order.businessId))
				.first();

			if (shopifyConnection) {
				ctx.scheduler.runAfter(0, internal.orders.shopify.triggerShopifyOrderCreation, {
					orderId: args.orderId,
				});
			}
		}

		return args.orderId;
	},
});
