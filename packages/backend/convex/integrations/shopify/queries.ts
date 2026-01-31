import { v } from "convex/values";
import { internalQuery, query } from "../../_generated/server";
import { getAuthUser, isBusinessOwner, requireBusinessOwnership } from "../../lib/auth";

export const getConnectionStatus = query({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return null;
		}

		try {
			await requireBusinessOwnership(ctx, args.businessId);
		} catch {
			return null;
		}

		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (!connection) {
			return { connected: false };
		}

		return {
			connected: true,
			shop: connection.shop,
			lastSyncAt: connection.lastSyncAt ?? null,
			lastSyncStatus: connection.lastSyncStatus ?? null,
			lastSyncError: connection.lastSyncError ?? null,
			scopes: connection.scopes,
		};
	},
});

export const verifyBusinessOwnership = internalQuery({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<{ authorized: boolean; error?: string }> => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return { authorized: false, error: "Not authenticated" };
		}

		const isOwner = await isBusinessOwner(ctx, args.businessId);
		if (!isOwner) {
			return { authorized: false, error: "Not authorized to access this business" };
		}

		return { authorized: true };
	},
});

export const getConnectionInternal = internalQuery({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (!connection) {
			return null;
		}

		const business = await ctx.db.get(args.businessId);
		if (!business) {
			return null;
		}

		return {
			shop: connection.shop,
			accessToken: connection.accessToken,
			business: {
				defaultLanguage: business.defaultLanguage,
			},
		};
	},
});

export const getConnectionByShop = internalQuery({
	args: {
		shop: v.string(),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_shop", (q) => q.eq("shop", args.shop))
			.first();

		if (!connection) {
			return null;
		}

		return {
			businessId: connection.businessId,
			accessToken: connection.accessToken,
		};
	},
});

export const getBusinessLanguage = internalQuery({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const business = await ctx.db.get(args.businessId);
		if (!business) {
			return null;
		}
		return {
			defaultLanguage: business.defaultLanguage,
		};
	},
});

export const getConnectionForWebhooks = internalQuery({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (!connection) {
			return null;
		}

		return {
			shop: connection.shop,
			accessToken: connection.accessToken,
		};
	},
});

export const getConnectionForDisconnect = internalQuery({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (!connection) {
			return null;
		}

		return {
			shop: connection.shop,
			accessToken: connection.accessToken,
			webhookIds: connection.webhookIds,
		};
	},
});

export const getOrderForShopify = internalQuery({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			return null;
		}

		const shopifyConnection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", order.businessId))
			.first();

		const productIds = order.items.map((item) => item.productId);
		const products = await Promise.all(productIds.map((id) => ctx.db.get(id)));

		return {
			order,
			products: products.filter((p) => p !== null),
			shopifyConnection: shopifyConnection
				? { shop: shopifyConnection.shop, accessToken: shopifyConnection.accessToken }
				: null,
		};
	},
});

export const getOrderByShopifyDraftOrderId = internalQuery({
	args: {
		shopifyDraftOrderId: v.string(),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db
			.query("orders")
			.withIndex("by_shopify_draft_order", (q) =>
				q.eq("shopifyDraftOrderId", args.shopifyDraftOrderId),
			)
			.first();

		if (!order) {
			return null;
		}

		const conversation = await ctx.db.get(order.conversationId);
		const business = await ctx.db.get(order.businessId);

		return {
			order,
			conversation,
			business,
		};
	},
});

export const getConversationForConfirmation = internalQuery({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.conversationId);
	},
});
