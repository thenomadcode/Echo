import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUser, requireBusinessOwnership } from "./lib/auth";

export const get = query({
	args: {
		customerId: v.id("customers"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
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
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		const business = await ctx.db.get(args.businessId);
		if (!business || business.ownerId !== authUser._id) {
			return null;
		}

		const customer = await ctx.db
			.query("customers")
			.withIndex("by_business_phone", (q) =>
				q.eq("businessId", args.businessId).eq("phone", args.phone),
			)
			.first();

		return customer;
	},
});

export const list = query({
	args: {
		businessId: v.id("businesses"),
		search: v.optional(v.string()),
		sortBy: v.optional(
			v.union(
				v.literal("lastSeenAt"),
				v.literal("totalOrders"),
				v.literal("totalSpent"),
				v.literal("createdAt"),
			),
		),
		includeAnonymized: v.optional(v.boolean()),
		cursor: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
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

		if (!args.includeAnonymized) {
			customers = customers.filter((c) => !c.isAnonymized);
		}

		if (args.search) {
			const searchLower = args.search.toLowerCase();
			customers = customers.filter(
				(c) =>
					c.phone.toLowerCase().includes(searchLower) ||
					c.name?.toLowerCase().includes(searchLower),
			);
		}

		const sortBy = args.sortBy ?? "lastSeenAt";
		customers.sort((a, b) => {
			if (sortBy === "lastSeenAt") {
				return b.lastSeenAt - a.lastSeenAt;
			}
			if (sortBy === "totalOrders") {
				return b.totalOrders - a.totalOrders;
			}
			if (sortBy === "totalSpent") {
				return b.totalSpent - a.totalSpent;
			}
			return b.createdAt - a.createdAt;
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
		await requireBusinessOwnership(ctx, args.businessId);

		const existingCustomer = await ctx.db
			.query("customers")
			.withIndex("by_business_phone", (q) =>
				q.eq("businessId", args.businessId).eq("phone", args.phone),
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
		preferredLanguage: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		await requireBusinessOwnership(ctx, customer.businessId);

		const updates: Record<string, unknown> = { updatedAt: Date.now() };

		if (args.name !== undefined) updates.name = args.name;
		if (args.preferredLanguage !== undefined) updates.preferredLanguage = args.preferredLanguage;

		await ctx.db.patch(args.customerId, updates);

		return args.customerId;
	},
});

export const getContext = query({
	args: {
		customerId: v.id("customers"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
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

		const [addresses, memories, notes] = await Promise.all([
			ctx.db
				.query("customerAddresses")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("customerMemory")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("customerNotes")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
		]);

		const sortedAddresses = addresses
			.sort((a, b) => {
				const aTime = a.lastUsedAt ?? a.createdAt;
				const bTime = b.lastUsedAt ?? b.createdAt;
				return bTime - aTime;
			})
			.map((a) => ({
				label: a.label,
				address: a.address,
				isDefault: a.isDefault,
			}));

		const allergies = memories.filter((m) => m.category === "allergy").map((m) => m.fact);
		const restrictions = memories.filter((m) => m.category === "restriction").map((m) => m.fact);
		const preferences = memories.filter((m) => m.category === "preference").map((m) => m.fact);
		const behaviors = memories.filter((m) => m.category === "behavior").map((m) => m.fact);

		const businessNotes = notes
			.filter((n) => !n.staffOnly)
			.sort((a, b) => b.createdAt - a.createdAt)
			.map((n) => n.note)
			.join("\n");

		return {
			profile: {
				name: customer.name,
				phone: customer.phone,
				preferredLanguage: customer.preferredLanguage,
				firstSeenAt: customer.firstSeenAt,
				lastSeenAt: customer.lastSeenAt,
				totalOrders: customer.totalOrders,
				totalSpent: customer.totalSpent,
			},
			addresses: sortedAddresses,
			memory: {
				allergies,
				restrictions,
				preferences,
				behaviors,
			},
			businessNotes,
		};
	},
});

export const updateStats = mutation({
	args: {
		customerId: v.id("customers"),
		orderTotal: v.number(),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		await requireBusinessOwnership(ctx, customer.businessId);

		const newTotalOrders = customer.totalOrders + 1;
		const newTotalSpent = customer.totalSpent + args.orderTotal;
		const newAverageOrderValue = Math.round(newTotalSpent / newTotalOrders);
		const now = Date.now();

		const updates: Record<string, unknown> = {
			totalOrders: newTotalOrders,
			totalSpent: newTotalSpent,
			averageOrderValue: newAverageOrderValue,
			lastOrderAt: now,
			updatedAt: now,
		};

		await ctx.db.patch(args.customerId, updates);

		return args.customerId;
	},
});

export const getOrCreate = internalMutation({
	args: {
		businessId: v.id("businesses"),
		phone: v.string(),
	},
	handler: async (ctx, args) => {
		const existingCustomer = await ctx.db
			.query("customers")
			.withIndex("by_business_phone", (q) =>
				q.eq("businessId", args.businessId).eq("phone", args.phone),
			)
			.first();

		if (existingCustomer) {
			const now = Date.now();
			await ctx.db.patch(existingCustomer._id, {
				lastSeenAt: now,
				updatedAt: now,
			});
			return existingCustomer._id;
		}

		const now = Date.now();
		const customerId = await ctx.db.insert("customers", {
			businessId: args.businessId,
			phone: args.phone,
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

// Internal query to load customer context for AI (no auth required)
// Used by AI prompt generation to include customer history in context
export const updateStatsInternal = internalMutation({
	args: {
		customerId: v.id("customers"),
		orderTotal: v.number(),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return null;
		}

		const newTotalOrders = customer.totalOrders + 1;
		const newTotalSpent = customer.totalSpent + args.orderTotal;
		const newAverageOrderValue = Math.round(newTotalSpent / newTotalOrders);
		const now = Date.now();

		const updates: Record<string, unknown> = {
			totalOrders: newTotalOrders,
			totalSpent: newTotalSpent,
			averageOrderValue: newAverageOrderValue,
			lastOrderAt: now,
			updatedAt: now,
		};

		await ctx.db.patch(args.customerId, updates);
		return args.customerId;
	},
});

export const getContextInternal = internalQuery({
	args: {
		customerId: v.id("customers"),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return null;
		}

		const [addresses, memories, notes] = await Promise.all([
			ctx.db
				.query("customerAddresses")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("customerMemory")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("customerNotes")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
		]);

		const sortedAddresses = addresses
			.sort((a, b) => {
				const aTime = a.lastUsedAt ?? a.createdAt;
				const bTime = b.lastUsedAt ?? b.createdAt;
				return bTime - aTime;
			})
			.map((a) => ({
				label: a.label,
				address: a.address,
				isDefault: a.isDefault,
			}));

		const allergies = memories.filter((m) => m.category === "allergy").map((m) => m.fact);
		const restrictions = memories.filter((m) => m.category === "restriction").map((m) => m.fact);
		const preferences = memories.filter((m) => m.category === "preference").map((m) => m.fact);
		const behaviors = memories.filter((m) => m.category === "behavior").map((m) => m.fact);

		const businessNotes = notes
			.filter((n) => !n.staffOnly)
			.sort((a, b) => b.createdAt - a.createdAt)
			.map((n) => n.note)
			.join("\n");

		return {
			profile: {
				name: customer.name,
				phone: customer.phone,
				preferredLanguage: customer.preferredLanguage,
				firstSeenAt: customer.firstSeenAt,
				lastSeenAt: customer.lastSeenAt,
				totalOrders: customer.totalOrders,
				totalSpent: customer.totalSpent,
			},
			addresses: sortedAddresses,
			memory: {
				allergies,
				restrictions,
				preferences,
				behaviors,
			},
			businessNotes,
		};
	},
});

export const deleteCustomer = mutation({
	args: {
		customerId: v.id("customers"),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		await requireBusinessOwnership(ctx, customer.businessId);

		const [addresses, memories, notes, summaries, orders, conversations] = await Promise.all([
			ctx.db
				.query("customerAddresses")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("customerMemory")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("customerNotes")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("conversationSummaries")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("orders")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("conversations")
				.withIndex("by_customer", (q) => q.eq("customerRecordId", args.customerId))
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

		await ctx.db.delete(args.customerId);

		return { success: true };
	},
});

export const anonymize = mutation({
	args: {
		customerId: v.id("customers"),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		await requireBusinessOwnership(ctx, customer.businessId);

		if (customer.isAnonymized) {
			throw new Error("Customer is already anonymized");
		}

		const [addresses, memories, notes, summaries] = await Promise.all([
			ctx.db
				.query("customerAddresses")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("customerMemory")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("customerNotes")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
			ctx.db
				.query("conversationSummaries")
				.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
				.collect(),
		]);

		await Promise.all([
			...addresses.map((a) => ctx.db.delete(a._id)),
			...memories.map((m) => ctx.db.delete(m._id)),
			...notes.map((n) => ctx.db.delete(n._id)),
			...summaries.map((s) => ctx.db.delete(s._id)),
		]);

		const anonymizedPhone = `anonymized-${args.customerId}`;
		const now = Date.now();

		await ctx.db.patch(args.customerId, {
			name: undefined,
			phone: anonymizedPhone,
			preferredLanguage: undefined,
			totalOrders: 0,
			totalSpent: 0,
			averageOrderValue: undefined,
			lastOrderAt: undefined,
			isAnonymized: true,
			updatedAt: now,
		});

		return { success: true };
	},
});
