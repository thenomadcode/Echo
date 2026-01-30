import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUser, isBusinessOwner } from "./lib/auth";

/**
 * Create a new product variant
 */
export const create = mutation({
	args: {
		productId: v.id("products"),
		name: v.string(),
		price: v.number(),
		sku: v.optional(v.string()),
		barcode: v.optional(v.string()),
		compareAtPrice: v.optional(v.number()),
		costPrice: v.optional(v.number()),
		inventoryQuantity: v.number(),
		inventoryPolicy: v.optional(v.union(v.literal("deny"), v.literal("continue"))),
		trackInventory: v.optional(v.boolean()),
		option1Name: v.optional(v.string()),
		option1Value: v.optional(v.string()),
		option2Name: v.optional(v.string()),
		option2Value: v.optional(v.string()),
		option3Name: v.optional(v.string()),
		option3Value: v.optional(v.string()),
		imageId: v.optional(v.string()),
		externalVariantId: v.optional(v.string()),
		weight: v.optional(v.number()),
		weightUnit: v.optional(
			v.union(v.literal("kg"), v.literal("g"), v.literal("lb"), v.literal("oz")),
		),
		requiresShipping: v.optional(v.boolean()),
		available: v.optional(v.boolean()),
		position: v.number(),
	},
	handler: async (ctx, args) => {
		const product = await ctx.db.get(args.productId);
		if (!product) {
			throw new Error("Product not found");
		}

		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const isOwner = await isBusinessOwner(ctx, product.businessId as any);
		if (!isOwner) {
			throw new Error("Not authorized to modify this product");
		}

		const now = Date.now();

		const variantId = await ctx.db.insert("productVariants", {
			productId: args.productId,
			name: args.name,
			price: args.price,
			sku: args.sku,
			barcode: args.barcode,
			compareAtPrice: args.compareAtPrice,
			costPrice: args.costPrice,
			inventoryQuantity: args.inventoryQuantity,
			inventoryPolicy: args.inventoryPolicy ?? "deny",
			trackInventory: args.trackInventory ?? true,
			option1Name: args.option1Name,
			option1Value: args.option1Value,
			option2Name: args.option2Name,
			option2Value: args.option2Value,
			option3Name: args.option3Name,
			option3Value: args.option3Value,
			imageId: args.imageId,
			externalVariantId: args.externalVariantId,
			weight: args.weight,
			weightUnit: args.weightUnit,
			requiresShipping: args.requiresShipping ?? true,
			available: args.available ?? true,
			position: args.position,
			createdAt: now,
			updatedAt: now,
		});

		return variantId;
	},
});

/**
 * Update an existing product variant
 */
export const update = mutation({
	args: {
		variantId: v.id("productVariants"),
		name: v.optional(v.string()),
		price: v.optional(v.number()),
		sku: v.optional(v.string()),
		barcode: v.optional(v.string()),
		compareAtPrice: v.optional(v.number()),
		costPrice: v.optional(v.number()),
		inventoryQuantity: v.optional(v.number()),
		inventoryPolicy: v.optional(v.union(v.literal("deny"), v.literal("continue"))),
		trackInventory: v.optional(v.boolean()),
		option1Name: v.optional(v.string()),
		option1Value: v.optional(v.string()),
		option2Name: v.optional(v.string()),
		option2Value: v.optional(v.string()),
		option3Name: v.optional(v.string()),
		option3Value: v.optional(v.string()),
		imageId: v.optional(v.string()),
		externalVariantId: v.optional(v.string()),
		weight: v.optional(v.number()),
		weightUnit: v.optional(
			v.union(v.literal("kg"), v.literal("g"), v.literal("lb"), v.literal("oz")),
		),
		requiresShipping: v.optional(v.boolean()),
		available: v.optional(v.boolean()),
		position: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const variant = await ctx.db.get(args.variantId);
		if (!variant) {
			throw new Error("Variant not found");
		}

		const product = await ctx.db.get(variant.productId);
		if (!product) {
			throw new Error("Product not found");
		}

		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const isOwner = await isBusinessOwner(ctx, product.businessId as any);
		if (!isOwner) {
			throw new Error("Not authorized to modify this variant");
		}

		const updates: Record<string, unknown> = { updatedAt: Date.now() };

		if (args.name !== undefined) updates.name = args.name;
		if (args.price !== undefined) updates.price = args.price;
		if (args.sku !== undefined) updates.sku = args.sku;
		if (args.barcode !== undefined) updates.barcode = args.barcode;
		if (args.compareAtPrice !== undefined) updates.compareAtPrice = args.compareAtPrice;
		if (args.costPrice !== undefined) updates.costPrice = args.costPrice;
		if (args.inventoryQuantity !== undefined) updates.inventoryQuantity = args.inventoryQuantity;
		if (args.inventoryPolicy !== undefined) updates.inventoryPolicy = args.inventoryPolicy;
		if (args.trackInventory !== undefined) updates.trackInventory = args.trackInventory;
		if (args.option1Name !== undefined) updates.option1Name = args.option1Name;
		if (args.option1Value !== undefined) updates.option1Value = args.option1Value;
		if (args.option2Name !== undefined) updates.option2Name = args.option2Name;
		if (args.option2Value !== undefined) updates.option2Value = args.option2Value;
		if (args.option3Name !== undefined) updates.option3Name = args.option3Name;
		if (args.option3Value !== undefined) updates.option3Value = args.option3Value;
		if (args.imageId !== undefined) updates.imageId = args.imageId;
		if (args.externalVariantId !== undefined) updates.externalVariantId = args.externalVariantId;
		if (args.weight !== undefined) updates.weight = args.weight;
		if (args.weightUnit !== undefined) updates.weightUnit = args.weightUnit;
		if (args.requiresShipping !== undefined) updates.requiresShipping = args.requiresShipping;
		if (args.available !== undefined) updates.available = args.available;
		if (args.position !== undefined) updates.position = args.position;

		await ctx.db.patch(args.variantId, updates);

		return args.variantId;
	},
});

/**
 * Soft delete a variant (sets available: false, preserves for order history)
 */
export const deleteVariant = mutation({
	args: {
		variantId: v.id("productVariants"),
	},
	handler: async (ctx, args) => {
		const variant = await ctx.db.get(args.variantId);
		if (!variant) {
			throw new Error("Variant not found");
		}

		const product = await ctx.db.get(variant.productId);
		if (!product) {
			throw new Error("Product not found");
		}

		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const isOwner = await isBusinessOwner(ctx, product.businessId as any);
		if (!isOwner) {
			throw new Error("Not authorized to delete this variant");
		}

		await ctx.db.patch(args.variantId, {
			available: false,
			updatedAt: Date.now(),
		});

		return args.variantId;
	},
});

/**
 * List all variants for a product (ordered by position)
 */
export const list = query({
	args: {
		productId: v.id("products"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return [];
		}

		const product = await ctx.db.get(args.productId);
		if (!product) {
			return [];
		}

		const isOwner = await isBusinessOwner(ctx, product.businessId as any);
		if (!isOwner) {
			return [];
		}

		const variants = await ctx.db
			.query("productVariants")
			.withIndex("by_product", (q) => q.eq("productId", args.productId))
			.collect();

		return variants.sort((a, b) => a.position - b.position);
	},
});

/**
 * Get a single variant
 */
export const get = query({
	args: {
		variantId: v.id("productVariants"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		const variant = await ctx.db.get(args.variantId);
		if (!variant) {
			return null;
		}

		const product = await ctx.db.get(variant.productId);
		if (!product) {
			return null;
		}

		const isOwner = await isBusinessOwner(ctx, product.businessId as any);
		if (!isOwner) {
			return null;
		}

		return variant;
	},
});

/**
 * Adjust inventory quantity by delta (increment or decrement)
 */
export const adjustInventory = mutation({
	args: {
		variantId: v.id("productVariants"),
		delta: v.number(),
	},
	handler: async (ctx, args) => {
		const variant = await ctx.db.get(args.variantId);
		if (!variant) {
			throw new Error("Variant not found");
		}

		const product = await ctx.db.get(variant.productId);
		if (!product) {
			throw new Error("Product not found");
		}

		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const isOwner = await isBusinessOwner(ctx, product.businessId as any);
		if (!isOwner) {
			throw new Error("Not authorized to adjust inventory for this variant");
		}

		const newQuantity = variant.inventoryQuantity + args.delta;

		if (newQuantity < 0) {
			throw new Error("Cannot adjust inventory below zero");
		}

		await ctx.db.patch(args.variantId, {
			inventoryQuantity: newQuantity,
			updatedAt: Date.now(),
		});

		return { newQuantity };
	},
});
