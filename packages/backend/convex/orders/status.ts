import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireBusinessOwnership } from "../lib/auth";

export const cancel = mutation({
	args: {
		orderId: v.id("orders"),
		reason: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);

		const nonCancellableStatuses = ["paid", "preparing", "ready", "delivered"];
		if (nonCancellableStatuses.includes(order.status)) {
			throw new Error("Order already paid, requires manual refund");
		}

		const now = Date.now();
		await ctx.db.patch(args.orderId, {
			status: "cancelled",
			cancelledAt: now,
			cancellationReason: args.reason,
			updatedAt: now,
		});

		return args.orderId;
	},
});

export const markPreparing = mutation({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);

		if (order.status !== "confirmed" && order.status !== "paid") {
			throw new Error("Order must be confirmed or paid to start preparing");
		}

		await ctx.db.patch(args.orderId, {
			status: "preparing",
			updatedAt: Date.now(),
		});

		return await ctx.db.get(args.orderId);
	},
});

export const markReady = mutation({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);

		if (order.status !== "preparing") {
			throw new Error("Order must be preparing to mark as ready");
		}

		await ctx.db.patch(args.orderId, {
			status: "ready",
			updatedAt: Date.now(),
		});

		return await ctx.db.get(args.orderId);
	},
});

export const markDelivered = mutation({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);

		if (order.status !== "ready") {
			throw new Error("Order must be ready to mark as delivered");
		}

		await ctx.db.patch(args.orderId, {
			status: "delivered",
			updatedAt: Date.now(),
		});

		return await ctx.db.get(args.orderId);
	},
});
