import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getWindowExpiresAt } from "./integrations/whatsapp/window";
import { authComponent } from "./auth";

export const get = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    return {
      ...conversation,
      windowExpiresAt: getWindowExpiresAt(conversation.lastCustomerMessageAt),
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
    channel: v.string(),
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
