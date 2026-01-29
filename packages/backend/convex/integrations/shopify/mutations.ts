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
			.withIndex("by_shopify_id", (q) =>
				q.eq("businessId", args.businessId).eq("shopifyProductId", args.shopifyProductId),
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
