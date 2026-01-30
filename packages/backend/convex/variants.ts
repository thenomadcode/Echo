import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireBusinessOwnership } from "./lib/auth";

export const create = mutation({
	args: {
		productId: v.id("products"),
		name: v.string(),
		sku: v.optional(v.string()),
		price: v.number(),
		inventoryQuantity: v.number(),
		option1Name: v.optional(v.string()),
		option1Value: v.optional(v.string()),
		option2Name: v.optional(v.string()),
		option2Value: v.optional(v.string()),
		option3Name: v.optional(v.string()),
		option3Value: v.optional(v.string()),
		imageId: v.optional(v.string()),
		available: v.optional(v.boolean()),
		position: v.optional(v.number()),
		compareAtPrice: v.optional(v.number()),
		costPrice: v.optional(v.number()),
		barcode: v.optional(v.string()),
		weight: v.optional(v.number()),
		weightUnit: v.optional(
			v.union(v.literal("kg"), v.literal("g"), v.literal("lb"), v.literal("oz")),
		),
		requiresShipping: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const product = await ctx.db.get(args.productId);
		if (!product) {
			throw new Error("Product not found");
		}
		await requireBusinessOwnership(ctx, product.businessId as any);

		const now = Date.now();

		let position = args.position;
		if (position === undefined) {
			const existingVariants = await ctx.db
				.query("productVariants")
				.withIndex("by_product", (q) => q.eq("productId", args.productId))
				.collect();
			const maxPosition = existingVariants.reduce((max, v) => Math.max(max, v.position), -1);
			position = maxPosition + 1;
		}

		const variantId = await ctx.db.insert("productVariants", {
			productId: args.productId,
			name: args.name,
			sku: args.sku,
			price: args.price,
			inventoryQuantity: args.inventoryQuantity,
			option1Name: args.option1Name,
			option1Value: args.option1Value,
			option2Name: args.option2Name,
			option2Value: args.option2Value,
			option3Name: args.option3Name,
			option3Value: args.option3Value,
			imageId: args.imageId,
			available: args.available ?? true,
			position,
			compareAtPrice: args.compareAtPrice,
			costPrice: args.costPrice,
			barcode: args.barcode,
			weight: args.weight,
			weightUnit: args.weightUnit,
			requiresShipping: args.requiresShipping,
			createdAt: now,
			updatedAt: now,
		});

		return variantId;
	},
});

export const update = mutation({
	args: {
		variantId: v.id("productVariants"),
		name: v.optional(v.string()),
		sku: v.optional(v.string()),
		price: v.optional(v.number()),
		inventoryQuantity: v.optional(v.number()),
		option1Name: v.optional(v.string()),
		option1Value: v.optional(v.string()),
		option2Name: v.optional(v.string()),
		option2Value: v.optional(v.string()),
		option3Name: v.optional(v.string()),
		option3Value: v.optional(v.string()),
		imageId: v.optional(v.string()),
		available: v.optional(v.boolean()),
		position: v.optional(v.number()),
		compareAtPrice: v.optional(v.number()),
		costPrice: v.optional(v.number()),
		barcode: v.optional(v.string()),
		weight: v.optional(v.number()),
		weightUnit: v.optional(
			v.union(v.literal("kg"), v.literal("g"), v.literal("lb"), v.literal("oz")),
		),
		requiresShipping: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const variant = await ctx.db.get(args.variantId);
		if (!variant) {
			throw new Error("Variant not found");
		}

		const product = await ctx.db.get(variant.productId);
		if (!product) {
			throw new Error("Parent product not found");
		}
		await requireBusinessOwnership(ctx, product.businessId as any);

		const updates: Record<string, unknown> = { updatedAt: Date.now() };

		if (args.name !== undefined) updates.name = args.name;
		if (args.sku !== undefined) updates.sku = args.sku;
		if (args.price !== undefined) updates.price = args.price;
		if (args.inventoryQuantity !== undefined) updates.inventoryQuantity = args.inventoryQuantity;
		if (args.option1Name !== undefined) updates.option1Name = args.option1Name;
		if (args.option1Value !== undefined) updates.option1Value = args.option1Value;
		if (args.option2Name !== undefined) updates.option2Name = args.option2Name;
		if (args.option2Value !== undefined) updates.option2Value = args.option2Value;
		if (args.option3Name !== undefined) updates.option3Name = args.option3Name;
		if (args.option3Value !== undefined) updates.option3Value = args.option3Value;
		if (args.imageId !== undefined) updates.imageId = args.imageId;
		if (args.available !== undefined) updates.available = args.available;
		if (args.position !== undefined) updates.position = args.position;
		if (args.compareAtPrice !== undefined) updates.compareAtPrice = args.compareAtPrice;
		if (args.costPrice !== undefined) updates.costPrice = args.costPrice;
		if (args.barcode !== undefined) updates.barcode = args.barcode;
		if (args.weight !== undefined) updates.weight = args.weight;
		if (args.weightUnit !== undefined) updates.weightUnit = args.weightUnit;
		if (args.requiresShipping !== undefined) updates.requiresShipping = args.requiresShipping;

		await ctx.db.patch(args.variantId, updates);

		return args.variantId;
	},
});

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
			throw new Error("Parent product not found");
		}
		await requireBusinessOwnership(ctx, product.businessId as any);

		await ctx.db.patch(args.variantId, {
			available: false,
			updatedAt: Date.now(),
		});

		return args.variantId;
	},
});

export const adjustInventory = mutation({
	args: {
		variantId: v.id("productVariants"),
		adjustment: v.number(),
	},
	handler: async (ctx, args) => {
		const variant = await ctx.db.get(args.variantId);
		if (!variant) {
			throw new Error("Variant not found");
		}

		const product = await ctx.db.get(variant.productId);
		if (!product) {
			throw new Error("Parent product not found");
		}
		await requireBusinessOwnership(ctx, product.businessId as any);

		const newInventory = variant.inventoryQuantity + args.adjustment;

		if (newInventory < 0) {
			throw new Error("Inventory cannot be negative");
		}

		await ctx.db.patch(args.variantId, {
			inventoryQuantity: newInventory,
			updatedAt: Date.now(),
		});

		return args.variantId;
	},
});
