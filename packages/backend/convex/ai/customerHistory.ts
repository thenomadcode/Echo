import { v } from "convex/values";
import { action, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

export const getCustomerForHistory = internalQuery({
  args: {
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      return null;
    }

    const business = await ctx.db.get(customer.businessId);
    if (!business) {
      return null;
    }

    return { customer, business };
  },
});

export const searchSummaries = internalQuery({
  args: {
    customerId: v.id("customers"),
    query: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const summaries = await ctx.db
      .query("conversationSummaries")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    const searchLower = args.query.toLowerCase();
    const matchingSummaries = summaries.filter((s) =>
      s.summary.toLowerCase().includes(searchLower)
    );

    matchingSummaries.sort((a, b) => b.createdAt - a.createdAt);

    return matchingSummaries.slice(0, args.limit);
  },
});

export const searchCustomerHistory = action({
  args: {
    customerId: v.id("customers"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    results: Array<{
      summary: string;
      sentiment: "positive" | "neutral" | "negative";
      keyEvents: string[];
      createdAt: number;
    }>;
    count: number;
  }> => {
    const limit = args.limit ?? 3;

    const customerData = await ctx.runQuery(
      internal.ai.customerHistory.getCustomerForHistory,
      { customerId: args.customerId }
    );

    if (!customerData) {
      return { results: [], count: 0 };
    }

    const summaries = await ctx.runQuery(
      internal.ai.customerHistory.searchSummaries,
      {
        customerId: args.customerId,
        query: args.query,
        limit,
      }
    );

    const results = summaries.map((s: Doc<"conversationSummaries">) => ({
      summary: s.summary,
      sentiment: s.sentiment,
      keyEvents: s.keyEvents,
      createdAt: s.createdAt,
    }));

    return {
      results,
      count: results.length,
    };
  },
});
