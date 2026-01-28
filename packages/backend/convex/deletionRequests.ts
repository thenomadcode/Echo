import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUser, isBusinessOwner } from "./lib/auth";

export const list = query({
	args: {
		businessId: v.id("businesses"),
		status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("denied"))),
	},
	handler: async (ctx, args) => {
		const isOwner = await isBusinessOwner(ctx, args.businessId);
		if (!isOwner) {
			return [];
		}

		let requests;
		if (args.status) {
			const status = args.status;
			requests = await ctx.db
				.query("deletionRequests")
				.withIndex("by_business_status", (q) =>
					q.eq("businessId", args.businessId).eq("status", status),
				)
				.order("desc")
				.collect();
		} else {
			requests = await ctx.db
				.query("deletionRequests")
				.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
				.order("desc")
				.collect();
		}

		const enrichedRequests = await Promise.all(
			requests.map(async (request) => {
				const customer = await ctx.db.get(request.customerId);
				return {
					...request,
					customerName: customer?.name,
					customerPhone: customer?.phone,
				};
			}),
		);

		return enrichedRequests;
	},
});

export const getPendingCount = query({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return 0;
		}

		const business = await ctx.db.get(args.businessId);
		if (!business || business.ownerId !== authUser._id) {
			return 0;
		}

		const requests = await ctx.db
			.query("deletionRequests")
			.withIndex("by_business_status", (q) =>
				q.eq("businessId", args.businessId).eq("status", "pending"),
			)
			.collect();

		return requests.length;
	},
});

export const create = internalMutation({
	args: {
		businessId: v.id("businesses"),
		customerId: v.id("customers"),
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const existingPending = await ctx.db
			.query("deletionRequests")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.filter((q) => q.eq(q.field("status"), "pending"))
			.first();

		if (existingPending) {
			return existingPending._id;
		}

		const requestId = await ctx.db.insert("deletionRequests", {
			businessId: args.businessId,
			customerId: args.customerId,
			conversationId: args.conversationId,
			status: "pending",
			createdAt: Date.now(),
		});

		return requestId;
	},
});

export const approve = mutation({
	args: {
		requestId: v.id("deletionRequests"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const request = await ctx.db.get(args.requestId);
		if (!request) {
			throw new Error("Request not found");
		}

		const business = await ctx.db.get(request.businessId);
		if (!business || business.ownerId !== authUser._id) {
			throw new Error("Not authorized");
		}

		if (request.status !== "pending") {
			throw new Error("Request already processed");
		}

		const now = Date.now();

		await ctx.db.patch(args.requestId, {
			status: "approved",
			processedBy: authUser._id,
			processedAt: now,
		});

		const customerId = request.customerId;
		const customer = await ctx.db.get(customerId);
		if (customer) {
			const [addresses, memories, notes, summaries, orders, conversations] = await Promise.all([
				ctx.db
					.query("customerAddresses")
					.withIndex("by_customer", (q) => q.eq("customerId", customerId))
					.collect(),
				ctx.db
					.query("customerMemory")
					.withIndex("by_customer", (q) => q.eq("customerId", customerId))
					.collect(),
				ctx.db
					.query("customerNotes")
					.withIndex("by_customer", (q) => q.eq("customerId", customerId))
					.collect(),
				ctx.db
					.query("conversationSummaries")
					.withIndex("by_customer", (q) => q.eq("customerId", customerId))
					.collect(),
				ctx.db
					.query("orders")
					.withIndex("by_customer", (q) => q.eq("customerId", customerId))
					.collect(),
				ctx.db
					.query("conversations")
					.withIndex("by_customer", (q) => q.eq("customerRecordId", customerId))
					.collect(),
			]);

			await Promise.all([
				...addresses.map((a) => ctx.db.delete(a._id)),
				...memories.map((m) => ctx.db.delete(m._id)),
				...notes.map((n) => ctx.db.delete(n._id)),
				...summaries.map((s) => ctx.db.delete(s._id)),
			]);

			await Promise.all(orders.map((o) => ctx.db.patch(o._id, { customerId: undefined })));

			await Promise.all(
				conversations.map((c) => ctx.db.patch(c._id, { customerRecordId: undefined })),
			);

			await ctx.db.delete(customerId);
		}

		return { success: true };
	},
});

export const deny = mutation({
	args: {
		requestId: v.id("deletionRequests"),
		reason: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const request = await ctx.db.get(args.requestId);
		if (!request) {
			throw new Error("Request not found");
		}

		const business = await ctx.db.get(request.businessId);
		if (!business || business.ownerId !== authUser._id) {
			throw new Error("Not authorized");
		}

		if (request.status !== "pending") {
			throw new Error("Request already processed");
		}

		const now = Date.now();

		await ctx.db.patch(args.requestId, {
			status: "denied",
			denialReason: args.reason,
			processedBy: authUser._id,
			processedAt: now,
		});

		return { success: true };
	},
});
