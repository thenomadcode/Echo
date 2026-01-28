import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const get = query({
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

		const business = await ctx.db.get(conversation.businessId);
		if (!business || business.ownerId !== authUser._id) {
			return null;
		}

		return await ctx.db
			.query("conversationSummaries")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.first();
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
			return [];
		}

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return [];
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business || business.ownerId !== authUser._id) {
			return [];
		}

		const limit = args.limit ?? 50;

		const summaries = await ctx.db
			.query("conversationSummaries")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.order("desc")
			.take(limit);

		return summaries;
	},
});

export const search = query({
	args: {
		customerId: v.id("customers"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return [];
		}

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return [];
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business || business.ownerId !== authUser._id) {
			return [];
		}

		const summaries = await ctx.db
			.query("conversationSummaries")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.collect();

		const searchLower = args.query.toLowerCase();
		const matchingSummaries = summaries.filter((s) =>
			s.summary.toLowerCase().includes(searchLower),
		);

		matchingSummaries.sort((a, b) => b.createdAt - a.createdAt);

		const limit = args.limit ?? 5;
		return matchingSummaries.slice(0, limit);
	},
});

export const create = mutation({
	args: {
		conversationId: v.id("conversations"),
		customerId: v.id("customers"),
		summary: v.string(),
		sentiment: v.optional(
			v.union(v.literal("positive"), v.literal("neutral"), v.literal("negative")),
		),
		keyEvents: v.optional(v.array(v.string())),
		orderIds: v.optional(v.array(v.id("orders"))),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const business = await ctx.db.get(conversation.businessId);
		if (!business) {
			throw new Error("Business not found");
		}

		if (business.ownerId !== authUser._id) {
			throw new Error("Not authorized to create summaries for this conversation");
		}

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		if (customer.businessId.toString() !== conversation.businessId.toString()) {
			throw new Error("Customer does not belong to the same business as conversation");
		}

		const existing = await ctx.db
			.query("conversationSummaries")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				summary: args.summary,
				sentiment: args.sentiment ?? "neutral",
				keyEvents: args.keyEvents ?? [],
				orderIds: args.orderIds,
			});
			return existing._id;
		}

		const summaryId = await ctx.db.insert("conversationSummaries", {
			conversationId: args.conversationId,
			customerId: args.customerId,
			summary: args.summary,
			sentiment: args.sentiment ?? "neutral",
			keyEvents: args.keyEvents ?? [],
			orderIds: args.orderIds,
			createdAt: Date.now(),
		});

		return summaryId;
	},
});

export const createInternal = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		customerId: v.id("customers"),
		summary: v.string(),
		sentiment: v.optional(
			v.union(v.literal("positive"), v.literal("neutral"), v.literal("negative")),
		),
		keyEvents: v.optional(v.array(v.string())),
		orderIds: v.optional(v.array(v.id("orders"))),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("conversationSummaries")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				summary: args.summary,
				sentiment: args.sentiment ?? "neutral",
				keyEvents: args.keyEvents ?? [],
				orderIds: args.orderIds,
			});
			return existing._id;
		}

		const summaryId = await ctx.db.insert("conversationSummaries", {
			conversationId: args.conversationId,
			customerId: args.customerId,
			summary: args.summary,
			sentiment: args.sentiment ?? "neutral",
			keyEvents: args.keyEvents ?? [],
			orderIds: args.orderIds,
			createdAt: Date.now(),
		});

		return summaryId;
	},
});
