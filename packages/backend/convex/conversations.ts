import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { getWindowExpiresAt } from "./integrations/whatsapp/window";

export const list = query({
	args: {
		businessId: v.id("businesses"),
		status: v.optional(v.union(v.literal("active"), v.literal("escalated"), v.literal("closed"))),
		search: v.optional(v.string()),
		limit: v.optional(v.number()),
		cursor: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			return { conversations: [], nextCursor: null };
		}

		const business = await ctx.db.get(args.businessId);
		if (!business || business.ownerId !== authUser._id) {
			return { conversations: [], nextCursor: null };
		}

		const limit = args.limit ?? 50;

		let conversationsQuery;
		if (args.status) {
			conversationsQuery = ctx.db
				.query("conversations")
				.withIndex("by_business_status", (q) =>
					q.eq("businessId", args.businessId).eq("status", args.status),
				);
		} else {
			conversationsQuery = ctx.db
				.query("conversations")
				.withIndex("by_business", (q) => q.eq("businessId", args.businessId));
		}

		let conversations = await conversationsQuery.collect();

		if (args.search) {
			const searchLower = args.search.toLowerCase();
			conversations = conversations.filter((c) => c.customerId.toLowerCase().includes(searchLower));
		}

		conversations.sort((a, b) => {
			if (a.status === "escalated" && b.status !== "escalated") return -1;
			if (a.status !== "escalated" && b.status === "escalated") return 1;
			return b.lastCustomerMessageAt - a.lastCustomerMessageAt;
		});

		const cursorIndex = args.cursor ? conversations.findIndex((c) => c._id === args.cursor) : -1;
		const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
		const paginatedConversations = conversations.slice(startIndex, startIndex + limit);

		const lastMessage = await Promise.all(
			paginatedConversations.map(async (conv) => {
				const messages = await ctx.db
					.query("messages")
					.withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
					.order("desc")
					.take(1);
				return messages[0] ?? null;
			}),
		);

		const enrichedConversations = paginatedConversations.map((conv, idx) => {
			const msg = lastMessage[idx];
			const hasUnread = msg && conv.lastReadAt ? msg.createdAt > conv.lastReadAt : !!msg;

			return {
				_id: conv._id,
				customerId: conv.customerId,
				status: conv.status ?? "active",
				assignedTo: conv.assignedTo ?? null,
				lastCustomerMessageAt: conv.lastCustomerMessageAt,
				lastReadAt: conv.lastReadAt ?? null,
				lastMessagePreview: msg?.content?.slice(0, 100) ?? null,
				lastMessageAt: msg?.createdAt ?? conv.lastCustomerMessageAt,
				hasUnread,
			};
		});

		const hasMore = startIndex + limit < conversations.length;
		const nextCursor = hasMore
			? (paginatedConversations[paginatedConversations.length - 1]?._id ?? null)
			: null;

		return {
			conversations: enrichedConversations,
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
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
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

		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_customer", (q) => q.eq("customerRecordId", args.customerId))
			.order("desc")
			.take(limit);

		return conversations;
	},
});

export const get = query({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
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

		const order = await ctx.db
			.query("orders")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.order("desc")
			.first();

		return {
			...conversation,
			windowExpiresAt: getWindowExpiresAt(conversation.lastCustomerMessageAt),
			order: order ?? null,
		};
	},
});

export const messages = query({
	args: {
		conversationId: v.id("conversations"),
		limit: v.optional(v.number()),
		cursor: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			return { messages: [], nextCursor: null };
		}

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return { messages: [], nextCursor: null };
		}

		const business = await ctx.db.get(conversation.businessId);
		if (!business || business.ownerId !== authUser._id) {
			return { messages: [], nextCursor: null };
		}

		const limit = args.limit ?? 100;

		const allMessages = await ctx.db
			.query("messages")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.order("asc")
			.collect();

		const cursorIndex = args.cursor ? allMessages.findIndex((m) => m._id === args.cursor) : -1;
		const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
		const paginatedMessages = allMessages.slice(startIndex, startIndex + limit);

		const hasMore = startIndex + limit < allMessages.length;
		const nextCursor = hasMore
			? (paginatedMessages[paginatedMessages.length - 1]?._id ?? null)
			: null;

		return {
			messages: paginatedMessages.map((msg) => ({
				_id: msg._id,
				sender: msg.sender,
				content: msg.content,
				createdAt: msg.createdAt,
				mediaUrl: msg.mediaUrl ?? null,
				mediaType: msg.mediaType ?? null,
			})),
			nextCursor,
		};
	},
});

export const listByBusiness = query({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.collect();

		return conversations.map((conversation) => ({
			...conversation,
			windowExpiresAt: getWindowExpiresAt(conversation.lastCustomerMessageAt),
		}));
	},
});

export const getWithMessages = query({
	args: {
		conversationId: v.id("conversations"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return null;
		}

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.order("desc")
			.take(args.limit ?? 50);

		return {
			...conversation,
			windowExpiresAt: getWindowExpiresAt(conversation.lastCustomerMessageAt),
			messages: messages.reverse(),
		};
	},
});

export const create = mutation({
	args: {
		businessId: v.id("businesses"),
		customerId: v.string(),
		channel: v.union(v.literal("whatsapp"), v.literal("instagram"), v.literal("messenger")),
		channelId: v.string(),
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
			throw new Error("Not authorized");
		}

		const now = Date.now();
		const conversationId = await ctx.db.insert("conversations", {
			businessId: args.businessId,
			customerId: args.customerId,
			channel: args.channel,
			channelId: args.channelId,
			state: "idle",
			lastCustomerMessageAt: now,
			createdAt: now,
			updatedAt: now,
		});

		return conversationId;
	},
});

export const addMessage = mutation({
	args: {
		conversationId: v.id("conversations"),
		content: v.string(),
		sender: v.string(),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const messageId = await ctx.db.insert("messages", {
			conversationId: args.conversationId,
			content: args.content,
			sender: args.sender,
			createdAt: Date.now(),
		});

		if (args.sender === "customer") {
			await ctx.db.patch(args.conversationId, {
				lastCustomerMessageAt: Date.now(),
				updatedAt: Date.now(),
			});
		}

		return messageId;
	},
});

export const takeOver = mutation({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			throw new Error("Not authenticated");
		}

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const business = await ctx.db.get(conversation.businessId);
		if (!business || business.ownerId !== authUser._id) {
			throw new Error("Not authorized");
		}

		const userId = authUser._id;
		const now = Date.now();

		const updates: Record<string, unknown> = {
			assignedTo: userId,
			lastReadAt: now,
			updatedAt: now,
		};

		if (conversation.status === "escalated") {
			updates.status = "active";
		}

		await ctx.db.patch(args.conversationId, updates);

		const notifications = await ctx.db
			.query("notifications")
			.withIndex("by_user", (q) => q.eq("userId", userId).eq("read", false))
			.filter((q) => q.eq(q.field("conversationId"), args.conversationId))
			.collect();

		for (const notification of notifications) {
			await ctx.db.patch(notification._id, { read: true });
		}

		return await ctx.db.get(args.conversationId);
	},
});

export const handBack = mutation({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			throw new Error("Not authenticated");
		}

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const userId = authUser._id;

		if (conversation.assignedTo !== userId) {
			throw new Error("Conversation is not assigned to you");
		}

		await ctx.db.patch(args.conversationId, {
			assignedTo: undefined,
			status: "active",
			updatedAt: Date.now(),
		});

		return await ctx.db.get(args.conversationId);
	},
});

export const close = mutation({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			throw new Error("Not authenticated");
		}

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const business = await ctx.db.get(conversation.businessId);
		if (!business || business.ownerId !== authUser._id) {
			throw new Error("Not authorized");
		}

		await ctx.db.patch(args.conversationId, {
			status: "closed",
			closedAt: Date.now(),
			updatedAt: Date.now(),
		});

		await ctx.scheduler.runAfter(0, internal.ai.summary.processConversationMemory, {
			conversationId: args.conversationId,
		});

		return await ctx.db.get(args.conversationId);
	},
});

export const reopen = mutation({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			throw new Error("Not authenticated");
		}

		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			throw new Error("Conversation not found");
		}

		const business = await ctx.db.get(conversation.businessId);
		if (!business || business.ownerId !== authUser._id) {
			throw new Error("Not authorized");
		}

		await ctx.db.patch(args.conversationId, {
			status: "active",
			closedAt: undefined,
			updatedAt: Date.now(),
		});

		return await ctx.db.get(args.conversationId);
	},
});
