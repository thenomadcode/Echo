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

export const getOrdersByCustomer = internalQuery({
  args: {
    customerId: v.id("customers"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    orders.sort((a, b) => b.createdAt - a.createdAt);

    return orders.slice(0, args.limit);
  },
});

export const getRecentOrders = action({
  args: {
    customerId: v.id("customers"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    orders: Array<{
      orderNumber: string;
      items: string[];
      total: number;
      status: string;
      createdAt: number;
    }>;
    count: number;
  }> => {
    const limit = args.limit ?? 5;

    const customerData = await ctx.runQuery(
      internal.ai.customerHistory.getCustomerForHistory,
      { customerId: args.customerId }
    );

    if (!customerData) {
      return { orders: [], count: 0 };
    }

    const orders = await ctx.runQuery(
      internal.ai.customerHistory.getOrdersByCustomer,
      {
        customerId: args.customerId,
        limit,
      }
    );

    const orderSummaries = orders.map((order: Doc<"orders">) => ({
      orderNumber: order.orderNumber,
      items: order.items.map((item) => `${item.quantity}x ${item.name}`),
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    }));

    return {
      orders: orderSummaries,
      count: orderSummaries.length,
    };
  },
});
