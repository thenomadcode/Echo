import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUser, requireBusinessOwnership } from "./lib/auth";

export const create = mutation({
	args: {
		businessId: v.string(),
		name: v.string(),
		order: v.number(),
	},
	handler: async (ctx, args) => {
		await requireBusinessOwnership(ctx, args.businessId as any);

		const now = Date.now();
		const categoryId = await ctx.db.insert("categories", {
			businessId: args.businessId,
			name: args.name,
			order: args.order,
			createdAt: now,
		});

		return categoryId;
	},
});

export const update = mutation({
	args: {
		categoryId: v.id("categories"),
		name: v.optional(v.string()),
		order: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const category = await ctx.db.get(args.categoryId);
		if (!category) {
			throw new Error("Category not found");
		}

		await requireBusinessOwnership(ctx, category.businessId as any);

		const updates: Record<string, unknown> = {};

		if (args.name !== undefined) updates.name = args.name;
		if (args.order !== undefined) updates.order = args.order;

		await ctx.db.patch(args.categoryId, updates);

		return args.categoryId;
	},
});

export const deleteCategory = mutation({
	args: {
		categoryId: v.id("categories"),
	},
	handler: async (ctx, args) => {
		const category = await ctx.db.get(args.categoryId);
		if (!category) {
			throw new Error("Category not found");
		}

		await requireBusinessOwnership(ctx, category.businessId as any);

		await ctx.db.delete(args.categoryId);

		return args.categoryId;
	},
});

export const list = query({
	args: {
		businessId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return [];
		}

		const business = await ctx.db
			.query("businesses")
			.filter((q) => q.eq(q.field("_id"), args.businessId))
			.first();

		if (!business || business.ownerId !== authUser._id) {
			return [];
		}

		const categories = await ctx.db
			.query("categories")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.collect();

		return categories.sort((a, b) => a.order - b.order);
	},
});

export const reorder = mutation({
	args: {
		businessId: v.string(),
		orderedIds: v.array(v.id("categories")),
	},
	handler: async (ctx, args) => {
		await requireBusinessOwnership(ctx, args.businessId as any);

		for (let i = 0; i < args.orderedIds.length; i++) {
			const categoryId = args.orderedIds[i];
			await ctx.db.patch(categoryId, { order: i });
		}

		return args.businessId;
	},
});
