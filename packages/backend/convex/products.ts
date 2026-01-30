import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUser, isBusinessOwner, requireAuth, requireBusinessOwnership } from "./lib/auth";

export const create = mutation({
	args: {
		businessId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		price: v.number(),
		categoryId: v.optional(v.string()),
		imageId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { business } = await requireBusinessOwnership(ctx, args.businessId as any);

		const now = Date.now();

		const existingProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.collect();

		const maxOrder = existingProducts.reduce((max, p) => Math.max(max, p.order), -1);

		const productId = await ctx.db.insert("products", {
			businessId: args.businessId,
			name: args.name,
			description: args.description,
			price: args.price,
			currency:
				business.defaultLanguage === "es"
					? "COP"
					: business.defaultLanguage === "pt"
						? "BRL"
						: "USD",
			categoryId: args.categoryId,
			imageId: args.imageId,
			available: true,
			deleted: false,
			hasVariants: false,
			order: maxOrder + 1,
			createdAt: now,
			updatedAt: now,
		});

		return productId;
	},
});

export const update = mutation({
	args: {
		productId: v.id("products"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		price: v.optional(v.number()),
		categoryId: v.optional(v.string()),
		imageId: v.optional(v.string()),
		available: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const product = await ctx.db.get(args.productId);
		if (!product) {
			throw new Error("Product not found");
		}

		await requireBusinessOwnership(ctx, product.businessId as any);

		const updates: Record<string, unknown> = { updatedAt: Date.now() };

		if (args.name !== undefined) updates.name = args.name;
		if (args.description !== undefined) updates.description = args.description;
		if (args.price !== undefined) updates.price = args.price;
		if (args.categoryId !== undefined) updates.categoryId = args.categoryId;
		if (args.imageId !== undefined) updates.imageId = args.imageId;
		if (args.available !== undefined) updates.available = args.available;

		await ctx.db.patch(args.productId, updates);

		return args.productId;
	},
});

export const deleteProduct = mutation({
	args: {
		productId: v.id("products"),
	},
	handler: async (ctx, args) => {
		const product = await ctx.db.get(args.productId);
		if (!product) {
			throw new Error("Product not found");
		}

		await requireBusinessOwnership(ctx, product.businessId as any);

		await ctx.db.patch(args.productId, {
			deleted: true,
			updatedAt: Date.now(),
		});

		return args.productId;
	},
});

export const get = query({
	args: {
		productId: v.id("products"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		const product = await ctx.db.get(args.productId);
		if (!product) {
			return null;
		}

		const isOwner = await isBusinessOwner(ctx, product.businessId as any);
		if (!isOwner) {
			return null;
		}

		return product;
	},
});

export const list = query({
	args: {
		businessId: v.string(),
		categoryId: v.optional(v.string()),
		available: v.optional(v.boolean()),
		search: v.optional(v.string()),
		limit: v.optional(v.number()),
		cursor: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return { products: [], hasMore: false, nextCursor: undefined };
		}

		const isOwner = await isBusinessOwner(ctx, args.businessId as any);
		if (!isOwner) {
			return { products: [], hasMore: false, nextCursor: undefined };
		}

		const productsQuery = ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId).eq("deleted", false));

		let allProducts = await productsQuery.collect();

		if (args.categoryId !== undefined) {
			allProducts = allProducts.filter((p) => p.categoryId === args.categoryId);
		}

		if (args.available !== undefined) {
			allProducts = allProducts.filter((p) => p.available === args.available);
		}

		if (args.search) {
			const searchLower = args.search.toLowerCase();
			allProducts = allProducts.filter(
				(p) =>
					p.name.toLowerCase().includes(searchLower) ||
					p.description?.toLowerCase().includes(searchLower),
			);
		}

		allProducts.sort((a, b) => a.order - b.order);

		const offset = args.cursor ?? 0;
		const limit = args.limit ?? 50;

		const paginatedProducts = allProducts.slice(offset, offset + limit);
		const hasMore = allProducts.length > offset + limit;
		const nextCursor = hasMore ? offset + limit : undefined;

		return {
			products: paginatedProducts,
			hasMore,
			nextCursor,
		};
	},
});

export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		await requireAuth(ctx);

		return await ctx.storage.generateUploadUrl();
	},
});

export const getImageUrl = query({
	args: {
		storageId: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		return await ctx.storage.getUrl(args.storageId);
	},
});

export const bulkUpdateAvailability = mutation({
	args: {
		productIds: v.array(v.id("products")),
		available: v.boolean(),
	},
	handler: async (ctx, args) => {
		await requireAuth(ctx);

		let updatedCount = 0;
		const now = Date.now();

		for (const productId of args.productIds) {
			const product = await ctx.db.get(productId);
			if (!product) {
				continue;
			}

			await requireBusinessOwnership(ctx, product.businessId as any);

			await ctx.db.patch(productId, {
				available: args.available,
				updatedAt: now,
			});

			updatedCount++;
		}

		return updatedCount;
	},
});

export const bulkDelete = mutation({
	args: {
		productIds: v.array(v.id("products")),
	},
	handler: async (ctx, args) => {
		await requireAuth(ctx);

		let deletedCount = 0;
		const now = Date.now();

		for (const productId of args.productIds) {
			const product = await ctx.db.get(productId);
			if (!product) {
				continue;
			}

			await requireBusinessOwnership(ctx, product.businessId as any);

			await ctx.db.patch(productId, {
				deleted: true,
				updatedAt: now,
			});

			deletedCount++;
		}

		return deletedCount;
	},
});

export const bulkUpdateCategory = mutation({
	args: {
		productIds: v.array(v.id("products")),
		categoryId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireAuth(ctx);

		let updatedCount = 0;
		const now = Date.now();

		for (const productId of args.productIds) {
			const product = await ctx.db.get(productId);
			if (!product) {
				continue;
			}

			await requireBusinessOwnership(ctx, product.businessId as any);

			await ctx.db.patch(productId, {
				categoryId: args.categoryId,
				updatedAt: now,
			});

			updatedCount++;
		}

		return updatedCount;
	},
});

export const createWithVariants = mutation({
	args: {
		businessId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		categoryId: v.optional(v.string()),
		imageId: v.optional(v.string()),
		hasVariants: v.boolean(),
		variants: v.array(
			v.object({
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
				compareAtPrice: v.optional(v.number()),
				costPrice: v.optional(v.number()),
				barcode: v.optional(v.string()),
				weight: v.optional(v.number()),
				weightUnit: v.optional(
					v.union(v.literal("kg"), v.literal("g"), v.literal("lb"), v.literal("oz")),
				),
				requiresShipping: v.optional(v.boolean()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const { business } = await requireBusinessOwnership(ctx, args.businessId as any);

		if (args.variants.length === 0) {
			throw new Error("At least one variant is required");
		}

		const now = Date.now();

		const existingProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.collect();
		const maxOrder = existingProducts.reduce((max, p) => Math.max(max, p.order), -1);

		const currency =
			business.defaultLanguage === "es" ? "COP" : business.defaultLanguage === "pt" ? "BRL" : "USD";

		const price = args.variants[0]!.price;

		const productId = await ctx.db.insert("products", {
			businessId: args.businessId,
			name: args.name,
			description: args.description,
			price,
			currency,
			categoryId: args.categoryId,
			imageId: args.imageId,
			available: true,
			deleted: false,
			hasVariants: args.hasVariants,
			order: maxOrder + 1,
			createdAt: now,
			updatedAt: now,
		});

		const createdVariantIds: string[] = [];
		for (let i = 0; i < args.variants.length; i++) {
			const variant = args.variants[i];
			if (!variant) continue;

			const variantId = await ctx.db.insert("productVariants", {
				productId,
				name: variant.name,
				sku: variant.sku,
				price: variant.price,
				inventoryQuantity: variant.inventoryQuantity,
				option1Name: variant.option1Name,
				option1Value: variant.option1Value,
				option2Name: variant.option2Name,
				option2Value: variant.option2Value,
				option3Name: variant.option3Name,
				option3Value: variant.option3Value,
				imageId: variant.imageId,
				available: variant.available ?? true,
				position: i,
				compareAtPrice: variant.compareAtPrice,
				costPrice: variant.costPrice,
				barcode: variant.barcode,
				weight: variant.weight,
				weightUnit: variant.weightUnit,
				requiresShipping: variant.requiresShipping,
				createdAt: now,
				updatedAt: now,
			});

			createdVariantIds.push(variantId as string);
		}

		const product = await ctx.db.get(productId);
		const variants = await Promise.all(createdVariantIds.map((id) => ctx.db.get(id as any)));

		return {
			...product,
			variants: variants.filter((v): v is NonNullable<typeof v> => v !== null),
		};
	},
});

export const updateWithVariants = mutation({
	args: {
		productId: v.id("products"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		categoryId: v.optional(v.string()),
		imageId: v.optional(v.string()),
		variantsToUpdate: v.optional(
			v.array(
				v.object({
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
				}),
			),
		),
		variantsToAdd: v.optional(
			v.array(
				v.object({
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
					compareAtPrice: v.optional(v.number()),
					costPrice: v.optional(v.number()),
					barcode: v.optional(v.string()),
					weight: v.optional(v.number()),
					weightUnit: v.optional(
						v.union(v.literal("kg"), v.literal("g"), v.literal("lb"), v.literal("oz")),
					),
					requiresShipping: v.optional(v.boolean()),
				}),
			),
		),
		variantsToRemove: v.optional(v.array(v.id("productVariants"))),
	},
	handler: async (ctx, args) => {
		const product = await ctx.db.get(args.productId);
		if (!product) {
			throw new Error("Product not found");
		}

		await requireBusinessOwnership(ctx, product.businessId as any);

		const now = Date.now();

		const productUpdates: Record<string, unknown> = { updatedAt: now };

		if (args.name !== undefined) productUpdates.name = args.name;
		if (args.description !== undefined) productUpdates.description = args.description;
		if (args.categoryId !== undefined) productUpdates.categoryId = args.categoryId;
		if (args.imageId !== undefined) productUpdates.imageId = args.imageId;

		await ctx.db.patch(args.productId, productUpdates);

		if (args.variantsToUpdate) {
			for (const variantUpdate of args.variantsToUpdate) {
				const variant = await ctx.db.get(variantUpdate.variantId);
				if (!variant) {
					continue;
				}

				if (variant.productId !== args.productId) {
					throw new Error("Variant does not belong to this product");
				}

				const updates: Record<string, unknown> = { updatedAt: now };

				if (variantUpdate.name !== undefined) updates.name = variantUpdate.name;
				if (variantUpdate.sku !== undefined) updates.sku = variantUpdate.sku;
				if (variantUpdate.price !== undefined) updates.price = variantUpdate.price;
				if (variantUpdate.inventoryQuantity !== undefined)
					updates.inventoryQuantity = variantUpdate.inventoryQuantity;
				if (variantUpdate.option1Name !== undefined)
					updates.option1Name = variantUpdate.option1Name;
				if (variantUpdate.option1Value !== undefined)
					updates.option1Value = variantUpdate.option1Value;
				if (variantUpdate.option2Name !== undefined)
					updates.option2Name = variantUpdate.option2Name;
				if (variantUpdate.option2Value !== undefined)
					updates.option2Value = variantUpdate.option2Value;
				if (variantUpdate.option3Name !== undefined)
					updates.option3Name = variantUpdate.option3Name;
				if (variantUpdate.option3Value !== undefined)
					updates.option3Value = variantUpdate.option3Value;
				if (variantUpdate.imageId !== undefined) updates.imageId = variantUpdate.imageId;
				if (variantUpdate.available !== undefined) updates.available = variantUpdate.available;
				if (variantUpdate.position !== undefined) updates.position = variantUpdate.position;
				if (variantUpdate.compareAtPrice !== undefined)
					updates.compareAtPrice = variantUpdate.compareAtPrice;
				if (variantUpdate.costPrice !== undefined) updates.costPrice = variantUpdate.costPrice;
				if (variantUpdate.barcode !== undefined) updates.barcode = variantUpdate.barcode;
				if (variantUpdate.weight !== undefined) updates.weight = variantUpdate.weight;
				if (variantUpdate.weightUnit !== undefined) updates.weightUnit = variantUpdate.weightUnit;
				if (variantUpdate.requiresShipping !== undefined)
					updates.requiresShipping = variantUpdate.requiresShipping;

				await ctx.db.patch(variantUpdate.variantId, updates);
			}
		}

		if (args.variantsToAdd) {
			const existingVariants = await ctx.db
				.query("productVariants")
				.withIndex("by_product", (q) => q.eq("productId", args.productId))
				.collect();
			const maxPosition = existingVariants.reduce((max, v) => Math.max(max, v.position), -1);

			for (let i = 0; i < args.variantsToAdd.length; i++) {
				const variant = args.variantsToAdd[i];
				if (!variant) continue;

				await ctx.db.insert("productVariants", {
					productId: args.productId,
					name: variant.name,
					sku: variant.sku,
					price: variant.price,
					inventoryQuantity: variant.inventoryQuantity,
					option1Name: variant.option1Name,
					option1Value: variant.option1Value,
					option2Name: variant.option2Name,
					option2Value: variant.option2Value,
					option3Name: variant.option3Name,
					option3Value: variant.option3Value,
					imageId: variant.imageId,
					available: variant.available ?? true,
					position: maxPosition + 1 + i,
					compareAtPrice: variant.compareAtPrice,
					costPrice: variant.costPrice,
					barcode: variant.barcode,
					weight: variant.weight,
					weightUnit: variant.weightUnit,
					requiresShipping: variant.requiresShipping,
					createdAt: now,
					updatedAt: now,
				});
			}
		}

		if (args.variantsToRemove) {
			for (const variantId of args.variantsToRemove) {
				const variant = await ctx.db.get(variantId);
				if (!variant) {
					continue;
				}

				if (variant.productId !== args.productId) {
					throw new Error("Variant does not belong to this product");
				}

				await ctx.db.patch(variantId, {
					available: false,
					updatedAt: now,
				});
			}
		}

		const updatedProduct = await ctx.db.get(args.productId);
		const variants = await ctx.db
			.query("productVariants")
			.withIndex("by_product", (q) => q.eq("productId", args.productId))
			.collect();

		return {
			...updatedProduct,
			variants: variants.sort((a, b) => a.position - b.position),
		};
	},
});

export const seedTestProducts = internalMutation({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId).eq("deleted", false))
			.collect();

		if (existing.length > 0) {
			return { seeded: false, message: "Products already exist for this business" };
		}

		const now = Date.now();
		const testProducts = [
			{ name: "Cappuccino", description: "Creamy Italian coffee", price: 450 },
			{ name: "Latte", description: "Smooth espresso with steamed milk", price: 500 },
			{
				name: "Chocolate Croissant",
				description: "Buttery, flaky croissant with rich chocolate filling",
				price: 400,
			},
		];

		for (let i = 0; i < testProducts.length; i++) {
			const product = testProducts[i];
			if (!product) continue;
			await ctx.db.insert("products", {
				businessId: args.businessId,
				name: product.name,
				description: product.description,
				price: product.price,
				currency: "USD",
				available: true,
				deleted: false,
				hasVariants: false,
				order: i,
				createdAt: now,
				updatedAt: now,
			});
		}

		return { seeded: true, count: testProducts.length };
	},
});

export const getWithVariants = query({
	args: {
		productId: v.id("products"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		const product = await ctx.db.get(args.productId);
		if (!product) {
			return null;
		}

		const isOwner = await isBusinessOwner(ctx, product.businessId as any);
		if (!isOwner) {
			return null;
		}

		const variants = await ctx.db
			.query("productVariants")
			.withIndex("by_product", (q) => q.eq("productId", args.productId))
			.collect();

		return {
			...product,
			variants: variants.sort((a, b) => a.position - b.position),
		};
	},
});

export const listWithVariants = query({
	args: {
		businessId: v.string(),
		categoryId: v.optional(v.string()),
		available: v.optional(v.boolean()),
		search: v.optional(v.string()),
		limit: v.optional(v.number()),
		cursor: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return { products: [], hasMore: false, nextCursor: undefined };
		}

		const isOwner = await isBusinessOwner(ctx, args.businessId as any);
		if (!isOwner) {
			return { products: [], hasMore: false, nextCursor: undefined };
		}

		const productsQuery = ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId).eq("deleted", false));

		let allProducts = await productsQuery.collect();

		if (args.categoryId !== undefined) {
			allProducts = allProducts.filter((p) => p.categoryId === args.categoryId);
		}

		if (args.available !== undefined) {
			allProducts = allProducts.filter((p) => p.available === args.available);
		}

		if (args.search) {
			const searchLower = args.search.toLowerCase();
			allProducts = allProducts.filter(
				(p) =>
					p.name.toLowerCase().includes(searchLower) ||
					p.description?.toLowerCase().includes(searchLower),
			);
		}

		allProducts.sort((a, b) => a.order - b.order);

		const offset = args.cursor ?? 0;
		const limit = args.limit ?? 50;

		const paginatedProducts = allProducts.slice(offset, offset + limit);

		const productsWithVariants = await Promise.all(
			paginatedProducts.map(async (product) => {
				const variants = await ctx.db
					.query("productVariants")
					.withIndex("by_product", (q) => q.eq("productId", product._id))
					.collect();

				return {
					...product,
					variants: variants.sort((a, b) => a.position - b.position),
					variantCount: variants.length,
				};
			}),
		);

		const hasMore = allProducts.length > offset + limit;
		const nextCursor = hasMore ? offset + limit : undefined;

		return {
			products: productsWithVariants,
			hasMore,
			nextCursor,
		};
	},
});
