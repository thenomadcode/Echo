import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUser, requireBusinessOwnership } from "./lib/auth";

const categoryValidator = v.union(
	v.literal("allergy"),
	v.literal("restriction"),
	v.literal("preference"),
	v.literal("behavior"),
	v.literal("complaint"),
);

const sourceValidator = v.union(
	v.literal("ai_extracted"),
	v.literal("manual"),
	v.literal("order_history"),
);

export const list = query({
	args: {
		customerId: v.id("customers"),
		category: v.optional(categoryValidator),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
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

		if (args.category !== undefined) {
			const category = args.category;
			return await ctx.db
				.query("customerMemory")
				.withIndex("by_customer_category", (q) =>
					q.eq("customerId", args.customerId).eq("category", category),
				)
				.collect();
		}

		return await ctx.db
			.query("customerMemory")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.collect();
	},
});

export const add = mutation({
	args: {
		customerId: v.id("customers"),
		category: categoryValidator,
		fact: v.string(),
		source: sourceValidator,
		confidence: v.optional(v.number()),
		extractedFrom: v.optional(v.id("conversations")),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		await requireBusinessOwnership(ctx, customer.businessId as any);

		const confidence = args.confidence ?? (args.source === "manual" ? 1.0 : 0.9);

		const now = Date.now();
		const memoryId = await ctx.db.insert("customerMemory", {
			customerId: args.customerId,
			category: args.category,
			fact: args.fact,
			source: args.source,
			confidence,
			extractedFrom: args.extractedFrom,
			createdAt: now,
			updatedAt: now,
		});

		return memoryId;
	},
});

export const update = mutation({
	args: {
		memoryId: v.id("customerMemory"),
		fact: v.optional(v.string()),
		confidence: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const memory = await ctx.db.get(args.memoryId);
		if (!memory) {
			throw new Error("Memory not found");
		}

		const customer = await ctx.db.get(memory.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		await requireBusinessOwnership(ctx, customer.businessId as any);

		const updates: Record<string, unknown> = { updatedAt: Date.now() };
		if (args.fact !== undefined) updates.fact = args.fact;
		if (args.confidence !== undefined) updates.confidence = args.confidence;

		await ctx.db.patch(args.memoryId, updates);

		return args.memoryId;
	},
});

export const deleteMemory = mutation({
	args: {
		memoryId: v.id("customerMemory"),
		confirmAllergyDeletion: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const memory = await ctx.db.get(args.memoryId);
		if (!memory) {
			throw new Error("Memory not found");
		}

		const customer = await ctx.db.get(memory.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		await requireBusinessOwnership(ctx, customer.businessId as any);

		if (memory.category === "allergy" && args.confirmAllergyDeletion !== true) {
			throw new Error(
				"Deleting allergies requires explicit confirmation. Set confirmAllergyDeletion to true.",
			);
		}

		await ctx.db.delete(args.memoryId);

		return args.memoryId;
	},
});

export const listByCustomerInternal = internalQuery({
	args: {
		customerId: v.id("customers"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("customerMemory")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.collect();
	},
});

export const addInternal = internalMutation({
	args: {
		customerId: v.id("customers"),
		category: categoryValidator,
		fact: v.string(),
		source: sourceValidator,
		confidence: v.number(),
		extractedFrom: v.optional(v.id("conversations")),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const memoryId = await ctx.db.insert("customerMemory", {
			customerId: args.customerId,
			category: args.category,
			fact: args.fact,
			source: args.source,
			confidence: args.confidence,
			extractedFrom: args.extractedFrom,
			createdAt: now,
			updatedAt: now,
		});

		return memoryId;
	},
});
