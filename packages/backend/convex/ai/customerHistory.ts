import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

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

const memoryCategory = v.union(
  v.literal("allergy"),
  v.literal("restriction"),
  v.literal("preference"),
  v.literal("behavior")
);

export const getExistingMemory = internalQuery({
  args: {
    customerId: v.id("customers"),
    category: memoryCategory,
    fact: v.string(),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("customerMemory")
      .withIndex("by_customer_category", (q) =>
        q.eq("customerId", args.customerId).eq("category", args.category)
      )
      .collect();

    const factLower = args.fact.toLowerCase().trim();
    return memories.find((m) => m.fact.toLowerCase().trim() === factLower) ?? null;
  },
});

export const insertMemory = internalMutation({
  args: {
    customerId: v.id("customers"),
    category: memoryCategory,
    fact: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<Id<"customerMemory">> => {
    const now = Date.now();
    return await ctx.db.insert("customerMemory", {
      customerId: args.customerId,
      category: args.category,
      fact: args.fact,
      confidence: 0.9,
      source: "ai_extracted",
      extractedFrom: args.conversationId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const saveCustomerPreference = action({
  args: {
    customerId: v.id("customers"),
    category: memoryCategory,
    fact: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<{
    status: "success" | "already_exists";
    memoryId?: Id<"customerMemory">;
  }> => {
    const customerData = await ctx.runQuery(
      internal.ai.customerHistory.getCustomerForHistory,
      { customerId: args.customerId }
    );

    if (!customerData) {
      throw new Error("Customer not found");
    }

    const existing = await ctx.runQuery(
      internal.ai.customerHistory.getExistingMemory,
      {
        customerId: args.customerId,
        category: args.category,
        fact: args.fact,
      }
    );

    if (existing) {
      return { status: "already_exists", memoryId: existing._id };
    }

    const memoryId = await ctx.runMutation(
      internal.ai.customerHistory.insertMemory,
      {
        customerId: args.customerId,
        category: args.category,
        fact: args.fact,
        conversationId: args.conversationId,
      }
    );

    return { status: "success", memoryId };
  },
});

export const getAddressesForCustomer = internalQuery({
  args: {
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customerAddresses")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();
  },
});

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[,.\-#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyAddressMatch(addr1: string, addr2: string): boolean {
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);

  if (norm1 === norm2) return true;

  const words1 = new Set(norm1.split(" ").filter((w) => w.length > 2));
  const words2 = new Set(norm2.split(" ").filter((w) => w.length > 2));

  const intersection = [...words1].filter((w) => words2.has(w));
  const similarity = (intersection.length * 2) / (words1.size + words2.size);

  return similarity > 0.7;
}

function generateAddressLabel(address: string): string {
  const lower = address.toLowerCase();

  if (lower.includes("office") || lower.includes("oficina") || lower.includes("trabalho")) {
    return "Work";
  }
  if (lower.includes("home") || lower.includes("casa") || lower.includes("hogar")) {
    return "Home";
  }

  return "Address";
}

export const updateAddressLastUsed = internalMutation({
  args: {
    addressId: v.id("customerAddresses"),
    setAsDefault: v.boolean(),
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    if (args.setAsDefault) {
      const allAddresses = await ctx.db
        .query("customerAddresses")
        .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
        .collect();

      for (const addr of allAddresses) {
        if (addr.isDefault && addr._id !== args.addressId) {
          await ctx.db.patch(addr._id, { isDefault: false });
        }
      }
    }

    await ctx.db.patch(args.addressId, {
      lastUsedAt: Date.now(),
      ...(args.setAsDefault ? { isDefault: true } : {}),
    });
  },
});

export const insertAddress = internalMutation({
  args: {
    customerId: v.id("customers"),
    address: v.string(),
    label: v.string(),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"customerAddresses">> => {
    if (args.isDefault) {
      const allAddresses = await ctx.db
        .query("customerAddresses")
        .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
        .collect();

      for (const addr of allAddresses) {
        if (addr.isDefault) {
          await ctx.db.patch(addr._id, { isDefault: false });
        }
      }
    }

    return await ctx.db.insert("customerAddresses", {
      customerId: args.customerId,
      address: args.address,
      label: args.label,
      isDefault: args.isDefault,
      createdAt: Date.now(),
    });
  },
});

export const updateCustomerAddress = action({
  args: {
    customerId: v.id("customers"),
    address: v.string(),
    label: v.optional(v.string()),
    setAsDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    addressId: Id<"customerAddresses">;
    isNew: boolean;
  }> => {
    const customerData = await ctx.runQuery(
      internal.ai.customerHistory.getCustomerForHistory,
      { customerId: args.customerId }
    );

    if (!customerData) {
      throw new Error("Customer not found");
    }

    const existingAddresses = await ctx.runQuery(
      internal.ai.customerHistory.getAddressesForCustomer,
      { customerId: args.customerId }
    );

    const matchingAddress = existingAddresses.find((addr: Doc<"customerAddresses">) =>
      fuzzyAddressMatch(addr.address, args.address)
    );

    if (matchingAddress) {
      await ctx.runMutation(internal.ai.customerHistory.updateAddressLastUsed, {
        addressId: matchingAddress._id,
        setAsDefault: args.setAsDefault ?? false,
        customerId: args.customerId,
      });

      return { addressId: matchingAddress._id, isNew: false };
    }

    const label = args.label ?? generateAddressLabel(args.address);
    const isFirst = existingAddresses.length === 0;
    const isDefault = args.setAsDefault ?? isFirst;

    const addressId = await ctx.runMutation(internal.ai.customerHistory.insertAddress, {
      customerId: args.customerId,
      address: args.address,
      label,
      isDefault,
    });

    return { addressId, isNew: true };
  },
});

export const createDeletionRequestInternal = internalMutation({
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
      return { requestId: existingPending._id, alreadyExists: true };
    }

    const requestId = await ctx.db.insert("deletionRequests", {
      businessId: args.businessId,
      customerId: args.customerId,
      conversationId: args.conversationId,
      status: "pending",
      createdAt: Date.now(),
    });

    return { requestId, alreadyExists: false };
  },
});

export const createDeletionRequest = action({
  args: {
    customerId: v.id("customers"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const customerData = await ctx.runQuery(
      internal.ai.customerHistory.getCustomerForHistory,
      { customerId: args.customerId }
    );

    if (!customerData) {
      return { success: false, message: "Customer not found" };
    }

    const result = await ctx.runMutation(
      internal.ai.customerHistory.createDeletionRequestInternal,
      {
        businessId: customerData.business._id,
        customerId: args.customerId,
        conversationId: args.conversationId,
      }
    );

    if (result.alreadyExists) {
      return { 
        success: true, 
        message: "A deletion request is already pending. The business will review it shortly." 
      };
    }

    return { 
      success: true, 
      message: "Your data deletion request has been submitted. The business will review and process it within 7 days." 
    };
  },
});

export const addCustomerNoteInternal = internalMutation({
  args: {
    customerId: v.id("customers"),
    note: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<Id<"customerNotes">> => {
    return await ctx.db.insert("customerNotes", {
      customerId: args.customerId,
      note: args.note,
      addedBy: "ai" as const,
      staffOnly: false,
      createdAt: Date.now(),
    });
  },
});

export const addCustomerNote = action({
  args: {
    customerId: v.id("customers"),
    note: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; noteId?: Id<"customerNotes">; message: string }> => {
    const customerData = await ctx.runQuery(
      internal.ai.customerHistory.getCustomerForHistory,
      { customerId: args.customerId }
    );

    if (!customerData) {
      return { success: false, message: "Customer not found" };
    }

    const noteId = await ctx.runMutation(
      internal.ai.customerHistory.addCustomerNoteInternal,
      {
        customerId: args.customerId,
        note: args.note,
        conversationId: args.conversationId,
      }
    );

    return { success: true, noteId, message: "Note added successfully" };
  },
});
