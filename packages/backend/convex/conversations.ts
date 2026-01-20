import { v } from "convex/values";
import { query } from "./_generated/server";
import { getWindowExpiresAt } from "./integrations/whatsapp/window";

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
