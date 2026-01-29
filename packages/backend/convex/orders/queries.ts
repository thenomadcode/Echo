import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAuthUser, isBusinessOwner } from "../lib/auth";

export const get = query({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		const order = await ctx.db.get(args.orderId);
		if (!order) {
			return null;
		}

		const isOwner = await isBusinessOwner(ctx, order.businessId);
		if (!isOwner) {
			return null;
		}

		return order;
	},
});

export const getByConversation = query({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return null;
		}

		const isOwner = await isBusinessOwner(ctx, conversation.businessId);
		if (!isOwner) {
			return null;
		}

		const orders = await ctx.db
			.query("orders")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.order("desc")
			.first();

		return orders;
	},
});

export const getByOrderNumber = query({
	args: {
		orderNumber: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		const order = await ctx.db
			.query("orders")
			.withIndex("by_number", (q) => q.eq("orderNumber", args.orderNumber))
			.first();

		if (!order) {
			return null;
		}

		const isOwner = await isBusinessOwner(ctx, order.businessId);
		if (!isOwner) {
			return null;
		}

		return order;
	},
});

export const listByBusiness = query({
	args: {
		businessId: v.id("businesses"),
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
		limit: v.optional(v.number()),
		cursor: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return { orders: [], nextCursor: null };
		}

		const isOwner = await isBusinessOwner(ctx, args.businessId);
		if (!isOwner) {
			return { orders: [], nextCursor: null };
		}

		const limit = args.limit ?? 50;

		const ordersQuery = ctx.db
			.query("orders")
			.withIndex("by_business", (q) => {
				if (args.status) {
					return q.eq("businessId", args.businessId).eq("status", args.status);
				}
				return q.eq("businessId", args.businessId);
			})
			.order("desc");

		const orders = await ordersQuery.take(limit + 1);

		const hasMore = orders.length > limit;
		const page = hasMore ? orders.slice(0, limit) : orders;
		const nextCursor = hasMore && page.length > 0 ? page[page.length - 1]._id : null;

		return {
			orders: page,
			nextCursor,
		};
	},
});

export const listByCustomer = query({
	args: {
		customerId: v.id("customers"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return { orders: [] };
		}

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return { orders: [] };
		}

		const isOwner = await isBusinessOwner(ctx, customer.businessId);
		if (!isOwner) {
			return { orders: [] };
		}

		const limit = args.limit ?? 50;

		const orders = await ctx.db
			.query("orders")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.order("desc")
			.take(limit);

		return { orders };
	},
});
