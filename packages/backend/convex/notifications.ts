import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const create = internalMutation({
	args: {
		userId: v.string(),
		type: v.union(v.literal("escalation"), v.literal("new_order")),
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const notificationId = await ctx.db.insert("notifications", {
			userId: args.userId,
			type: args.type,
			conversationId: args.conversationId,
			read: false,
			createdAt: Date.now(),
		});
		return notificationId;
	},
});

export const list = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			return [];
		}

		const limit = args.limit ?? 20;

		const notifications = await ctx.db
			.query("notifications")
			.withIndex("by_user", (q) => q.eq("userId", authUser._id))
			.order("desc")
			.take(limit);

		return notifications;
	},
});

export const markRead = mutation({
	args: {
		notificationId: v.id("notifications"),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			throw new Error("Not authenticated");
		}

		const notification = await ctx.db.get(args.notificationId);
		if (!notification) {
			throw new Error("Notification not found");
		}

		if (notification.userId !== authUser._id) {
			throw new Error("Not authorized");
		}

		await ctx.db.patch(args.notificationId, { read: true });
		return await ctx.db.get(args.notificationId);
	},
});

export const markAllRead = mutation({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			throw new Error("Not authenticated");
		}

		const unreadNotifications = await ctx.db
			.query("notifications")
			.withIndex("by_user", (q) => q.eq("userId", authUser._id).eq("read", false))
			.collect();

		for (const notification of unreadNotifications) {
			await ctx.db.patch(notification._id, { read: true });
		}

		return { marked: unreadNotifications.length };
	},
});

export const unreadCount = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser || !authUser._id) {
			return 0;
		}

		const unreadNotifications = await ctx.db
			.query("notifications")
			.withIndex("by_user", (q) => q.eq("userId", authUser._id).eq("read", false))
			.collect();

		return unreadNotifications.length;
	},
});
