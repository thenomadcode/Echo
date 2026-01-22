import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const get = query({
  args: {
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      return null;
    }

    const business = await ctx.db.get(customer.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return null;
    }

    return customer;
  },
});

export const getByPhone = query({
  args: {
    businessId: v.id("businesses"),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return null;
    }

    const customer = await ctx.db
      .query("customers")
      .withIndex("by_business_phone", (q) =>
        q.eq("businessId", args.businessId).eq("phone", args.phone)
      )
      .first();

    return customer;
  },
});

export const list = query({
  args: {
    businessId: v.id("businesses"),
    search: v.optional(v.string()),
    tier: v.optional(
      v.union(
        v.literal("regular"),
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
        v.literal("vip")
      )
    ),
    sortBy: v.optional(
      v.union(
        v.literal("lastSeenAt"),
        v.literal("totalOrders"),
        v.literal("totalSpent"),
        v.literal("createdAt")
      )
    ),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return { customers: [], hasMore: false, nextCursor: undefined };
    }

    const business = await ctx.db.get(args.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return { customers: [], hasMore: false, nextCursor: undefined };
    }

    let customers = await ctx.db
      .query("customers")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    if (args.tier) {
      customers = customers.filter((c) => c.tier === args.tier);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      customers = customers.filter(
        (c) =>
          c.phone.toLowerCase().includes(searchLower) ||
          c.name?.toLowerCase().includes(searchLower)
      );
    }

    const sortBy = args.sortBy ?? "lastSeenAt";
    customers.sort((a, b) => {
      if (sortBy === "lastSeenAt") {
        return b.lastSeenAt - a.lastSeenAt;
      } else if (sortBy === "totalOrders") {
        return b.totalOrders - a.totalOrders;
      } else if (sortBy === "totalSpent") {
        return b.totalSpent - a.totalSpent;
      } else {
        return b.createdAt - a.createdAt;
      }
    });

    const offset = args.cursor ?? 0;
    const limit = args.limit ?? 50;

    const paginatedCustomers = customers.slice(offset, offset + limit);
    const hasMore = customers.length > offset + limit;
    const nextCursor = hasMore ? offset + limit : undefined;

    return {
      customers: paginatedCustomers,
      hasMore,
      nextCursor,
    };
  },
});

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    phone: v.string(),
    name: v.optional(v.string()),
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
      throw new Error("Not authorized to create customers for this business");
    }

    const existingCustomer = await ctx.db
      .query("customers")
      .withIndex("by_business_phone", (q) =>
        q.eq("businessId", args.businessId).eq("phone", args.phone)
      )
      .first();

    if (existingCustomer) {
      throw new Error("Customer with this phone number already exists");
    }

    const now = Date.now();

    const customerId = await ctx.db.insert("customers", {
      businessId: args.businessId,
      phone: args.phone,
      name: args.name,
      tier: "regular",
      totalOrders: 0,
      totalSpent: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return customerId;
  },
});

export const update = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    tier: v.optional(
      v.union(
        v.literal("regular"),
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
        v.literal("vip")
      )
    ),
    preferredLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const business = await ctx.db.get(customer.businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to update this customer");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.preferredLanguage !== undefined)
      updates.preferredLanguage = args.preferredLanguage;
    if (args.tier !== undefined) {
      updates.manualTier = args.tier;
      updates.tier = args.tier;
      updates.tierUpdatedAt = Date.now();
    }

    await ctx.db.patch(args.customerId, updates);

    return args.customerId;
  },
});
