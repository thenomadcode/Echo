import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";

export const saveConnection = internalMutation({
	args: {
		businessId: v.id("businesses"),
		shop: v.string(),
		accessToken: v.string(),
		scopes: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const existingConnection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (existingConnection) {
			await ctx.db.patch(existingConnection._id, {
				shop: args.shop,
				accessToken: args.accessToken,
				scopes: args.scopes,
			});
			return existingConnection._id;
		}

		const connectionId = await ctx.db.insert("shopifyConnections", {
			businessId: args.businessId,
			shop: args.shop,
			accessToken: args.accessToken,
			scopes: args.scopes,
			createdAt: Date.now(),
		});

		return connectionId;
	},
});

export const upsertProduct = internalMutation({
	args: {
		businessId: v.id("businesses"),
		shopifyProductId: v.string(),
		shopifyVariantId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		price: v.number(),
		currency: v.string(),
		imageUrl: v.optional(v.string()),
		available: v.boolean(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("products")
			.withIndex("by_shopify_id", (q) =>
				q.eq("businessId", args.businessId).eq("shopifyProductId", args.shopifyProductId),
			)
			.filter((q) => q.eq(q.field("shopifyVariantId"), args.shopifyVariantId))
			.first();

		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				name: args.name,
				description: args.description,
				price: args.price,
				available: args.available,
				lastShopifySyncAt: now,
				updatedAt: now,
			});
			return existing._id;
		}

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
			currency: args.currency,
			available: args.available,
			deleted: false,
			order: maxOrder + 1,
			source: "shopify",
			shopifyProductId: args.shopifyProductId,
			shopifyVariantId: args.shopifyVariantId,
			lastShopifySyncAt: now,
			createdAt: now,
			updatedAt: now,
		});

		return productId;
	},
});

export const upsertProductWithStats = internalMutation({
	args: {
		businessId: v.id("businesses"),
		shopifyProductId: v.string(),
		shopifyVariantId: v.string(),
		name: v.string(),
		description: v.optional(v.string()),
		price: v.number(),
		currency: v.string(),
		imageUrl: v.optional(v.string()),
		available: v.boolean(),
	},
	handler: async (ctx, args): Promise<{ isNew: boolean }> => {
		const existing = await ctx.db
			.query("products")
			.withIndex("by_shopify_id", (q) =>
				q.eq("businessId", args.businessId).eq("shopifyProductId", args.shopifyProductId),
			)
			.filter((q) => q.eq(q.field("shopifyVariantId"), args.shopifyVariantId))
			.first();

		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				name: args.name,
				description: args.description,
				price: args.price,
				available: args.available,
				lastShopifySyncAt: now,
				updatedAt: now,
			});
			return { isNew: false };
		}

		const existingProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.collect();

		const maxOrder = existingProducts.reduce((max, p) => Math.max(max, p.order), -1);

		await ctx.db.insert("products", {
			businessId: args.businessId,
			name: args.name,
			description: args.description,
			price: args.price,
			currency: args.currency,
			available: args.available,
			deleted: false,
			order: maxOrder + 1,
			source: "shopify",
			shopifyProductId: args.shopifyProductId,
			shopifyVariantId: args.shopifyVariantId,
			lastShopifySyncAt: now,
			createdAt: now,
			updatedAt: now,
		});

		return { isNew: true };
	},
});

export const updateSyncStatus = internalMutation({
	args: {
		businessId: v.id("businesses"),
		status: v.union(v.literal("success"), v.literal("partial"), v.literal("failed")),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (connection) {
			await ctx.db.patch(connection._id, {
				lastSyncAt: Date.now(),
				lastSyncStatus: args.status,
			});
		}
	},
});

export const markProductsUnavailable = internalMutation({
	args: {
		businessId: v.id("businesses"),
		shopifyProductId: v.string(),
	},
	handler: async (ctx, args): Promise<number> => {
		const products = await ctx.db
			.query("products")
			.withIndex("by_external_id", (q) =>
				q
					.eq("businessId", args.businessId)
					.eq("source", "shopify")
					.eq("externalProductId", args.shopifyProductId),
			)
			.collect();

		const now = Date.now();
		let count = 0;

		for (const product of products) {
			await ctx.db.patch(product._id, {
				available: false,
				lastShopifySyncAt: now,
				updatedAt: now,
			});
			count++;

			const variants = await ctx.db
				.query("productVariants")
				.withIndex("by_product", (q) => q.eq("productId", product._id))
				.collect();

			for (const variant of variants) {
				await ctx.db.patch(variant._id, {
					available: false,
					lastSyncAt: now,
					updatedAt: now,
				});
			}
		}

		return count;
	},
});

export const markMissingProductsUnavailable = internalMutation({
	args: {
		businessId: v.id("businesses"),
		seenShopifyVariantIds: v.array(v.string()),
	},
	handler: async (ctx, args): Promise<number> => {
		const shopifyProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.filter((q) => q.and(q.eq(q.field("source"), "shopify"), q.eq(q.field("available"), true)))
			.collect();

		const seenSet = new Set(args.seenShopifyVariantIds);
		const now = Date.now();
		let count = 0;

		for (const product of shopifyProducts) {
			if (product.shopifyVariantId && !seenSet.has(product.shopifyVariantId)) {
				await ctx.db.patch(product._id, {
					available: false,
					lastShopifySyncAt: now,
					updatedAt: now,
				});
				count++;
			}
		}

		return count;
	},
});

/**
 * Mark variants that no longer exist in Shopify as unavailable (for full sync)
 */
export const markMissingVariantsUnavailable = internalMutation({
	args: {
		businessId: v.id("businesses"),
		seenExternalVariantIds: v.array(v.string()),
	},
	handler: async (ctx, args): Promise<number> => {
		const shopifyProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.filter((q) => q.eq(q.field("source"), "shopify"))
			.collect();

		const productIds = shopifyProducts.map((p) => p._id);

		const seenSet = new Set(args.seenExternalVariantIds);
		const now = Date.now();
		let count = 0;

		for (const productId of productIds) {
			const variants = await ctx.db
				.query("productVariants")
				.withIndex("by_product", (q) => q.eq("productId", productId))
				.filter((q) => q.eq(q.field("available"), true))
				.collect();

			for (const variant of variants) {
				if (variant.externalVariantId && !seenSet.has(variant.externalVariantId)) {
					await ctx.db.patch(variant._id, {
						available: false,
						lastSyncAt: now,
						updatedAt: now,
					});
					count++;
				}
			}
		}

		return count;
	},
});

export const markMissingProductVariantsUnavailable = internalMutation({
	args: {
		productId: v.id("products"),
		seenExternalVariantIds: v.array(v.string()),
	},
	handler: async (ctx, args): Promise<number> => {
		const variants = await ctx.db
			.query("productVariants")
			.withIndex("by_product", (q) => q.eq("productId", args.productId))
			.filter((q) => q.eq(q.field("available"), true))
			.collect();

		const seenSet = new Set(args.seenExternalVariantIds);
		const now = Date.now();
		let count = 0;

		for (const variant of variants) {
			if (variant.externalVariantId && !seenSet.has(variant.externalVariantId)) {
				await ctx.db.patch(variant._id, {
					available: false,
					lastSyncAt: now,
					updatedAt: now,
				});
				count++;
			}
		}

		return count;
	},
});

export const updateWebhookIds = internalMutation({
	args: {
		businessId: v.id("businesses"),
		webhookIds: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (connection) {
			await ctx.db.patch(connection._id, {
				webhookIds: args.webhookIds,
			});
		}
	},
});

export const updateOrderWithShopifyInfo = internalMutation({
	args: {
		orderId: v.id("orders"),
		shopifyOrderId: v.string(),
		shopifyOrderNumber: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.orderId, {
			shopifyOrderId: args.shopifyOrderId,
			shopifyOrderNumber: args.shopifyOrderNumber,
			paymentProvider: "shopify",
			updatedAt: Date.now(),
		});
	},
});

export const updateOrderWithDraftOrderInfo = internalMutation({
	args: {
		orderId: v.id("orders"),
		shopifyDraftOrderId: v.string(),
		shopifyOrderNumber: v.string(),
		invoiceUrl: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.orderId, {
			shopifyDraftOrderId: args.shopifyDraftOrderId,
			shopifyOrderNumber: args.shopifyOrderNumber,
			paymentLinkUrl: args.invoiceUrl,
			paymentProvider: "shopify",
			updatedAt: Date.now(),
		});
	},
});

export const updateOrderFromShopifyPayment = internalMutation({
	args: {
		orderId: v.id("orders"),
		shopifyOrderId: v.string(),
		shopifyOrderNumber: v.string(),
		financialStatus: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const updates: Record<string, unknown> = {
			shopifyOrderId: args.shopifyOrderId,
			shopifyOrderNumber: args.shopifyOrderNumber,
			updatedAt: now,
		};

		if (args.financialStatus === "paid") {
			updates.status = "paid";
			updates.paymentStatus = "paid";
		} else if (args.financialStatus === "partially_paid") {
			updates.paymentStatus = "pending";
		} else if (args.financialStatus === "refunded" || args.financialStatus === "voided") {
			updates.paymentStatus = "refunded";
		}

		await ctx.db.patch(args.orderId, updates);
		return await ctx.db.get(args.orderId);
	},
});

export const deleteConnectionAndClearProducts = internalMutation({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (connection) {
			await ctx.db.delete(connection._id);
		}

		const shopifyProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.filter((q) => q.eq(q.field("source"), "shopify"))
			.collect();

		const now = Date.now();

		for (const product of shopifyProducts) {
			await ctx.db.patch(product._id, {
				source: "manual",
				shopifyProductId: undefined,
				shopifyVariantId: undefined,
				lastShopifySyncAt: undefined,
				updatedAt: now,
			});
		}
	},
});

export const saveAiMessage = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		const messageId = await ctx.db.insert("messages", {
			conversationId: args.conversationId,
			sender: "ai",
			content: args.content,
			createdAt: Date.now(),
		});
		return messageId;
	},
});

/**
 * Upsert parent product (no variants stored on products table anymore)
 * Returns productId and whether it was newly created
 */
export const upsertParentProduct = internalMutation({
	args: {
		businessId: v.id("businesses"),
		externalProductId: v.string(), // Shopify GID
		name: v.string(),
		description: v.optional(v.string()),
		hasVariants: v.boolean(),
		imageId: v.optional(v.string()), // Convex storage ID (set when images are uploaded)
		available: v.boolean(),
	},
	handler: async (ctx, args): Promise<{ productId: any; isNew: boolean }> => {
		const existing = await ctx.db
			.query("products")
			.withIndex("by_external_id", (q) =>
				q
					.eq("businessId", args.businessId)
					.eq("source", "shopify")
					.eq("externalProductId", args.externalProductId),
			)
			.first();

		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				name: args.name,
				description: args.description,
				hasVariants: args.hasVariants,
				imageId: args.imageId,
				available: args.available,
				lastShopifySyncAt: now,
				updatedAt: now,
			});
			return { productId: existing._id, isNew: false };
		}

		const existingProducts = await ctx.db
			.query("products")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.collect();

		const maxOrder = existingProducts.reduce((max, p) => Math.max(max, p.order), -1);

		const productId = await ctx.db.insert("products", {
			businessId: args.businessId,
			name: args.name,
			description: args.description,
			hasVariants: args.hasVariants,
			imageId: args.imageId,
			available: args.available,
			deleted: false,
			order: maxOrder + 1,
			source: "shopify",
			externalProductId: args.externalProductId,
			lastShopifySyncAt: now,
			createdAt: now,
			updatedAt: now,
		});

		return { productId, isNew: true };
	},
});

/**
 * Upsert product variant
 * Returns variantId and whether it was newly created
 */
export const upsertProductVariant = internalMutation({
	args: {
		productId: v.id("products"),
		externalVariantId: v.string(), // Shopify variant GID
		name: v.string(), // Variant name (e.g., "Small / Red" or empty for simple products)
		sku: v.optional(v.string()),
		barcode: v.optional(v.string()),
		price: v.number(), // In cents
		compareAtPrice: v.optional(v.number()),
		inventoryQuantity: v.number(),
		inventoryPolicy: v.union(v.literal("deny"), v.literal("continue")),
		option1Name: v.optional(v.string()),
		option1Value: v.optional(v.string()),
		option2Name: v.optional(v.string()),
		option2Value: v.optional(v.string()),
		option3Name: v.optional(v.string()),
		option3Value: v.optional(v.string()),
		imageId: v.optional(v.string()), // Convex storage ID for variant image
		weight: v.optional(v.number()),
		weightUnit: v.optional(
			v.union(v.literal("kg"), v.literal("g"), v.literal("lb"), v.literal("oz")),
		),
		requiresShipping: v.boolean(),
		position: v.number(),
	},
	handler: async (ctx, args): Promise<{ variantId: any; isNew: boolean }> => {
		const existing = await ctx.db
			.query("productVariants")
			.withIndex("by_external_id", (q) => q.eq("externalVariantId", args.externalVariantId))
			.first();

		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				name: args.name,
				sku: args.sku,
				barcode: args.barcode,
				price: args.price,
				compareAtPrice: args.compareAtPrice,
				inventoryQuantity: args.inventoryQuantity,
				inventoryPolicy: args.inventoryPolicy,
				option1Name: args.option1Name,
				option1Value: args.option1Value,
				option2Name: args.option2Name,
				option2Value: args.option2Value,
				option3Name: args.option3Name,
				option3Value: args.option3Value,
				imageId: args.imageId,
				weight: args.weight,
				weightUnit: args.weightUnit,
				requiresShipping: args.requiresShipping,
				position: args.position,
				available: args.inventoryQuantity > 0,
				lastSyncAt: now,
				updatedAt: now,
			});
			return { variantId: existing._id, isNew: false };
		}

		const variantId = await ctx.db.insert("productVariants", {
			productId: args.productId,
			name: args.name,
			sku: args.sku,
			barcode: args.barcode,
			price: args.price,
			compareAtPrice: args.compareAtPrice,
			inventoryQuantity: args.inventoryQuantity,
			inventoryPolicy: args.inventoryPolicy,
			trackInventory: true,
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
			requiresShipping: args.requiresShipping,
			available: args.inventoryQuantity > 0,
			position: args.position,
			lastSyncAt: now,
			createdAt: now,
			updatedAt: now,
		});

		return { variantId, isNew: true };
	},
});
