import { v } from "convex/values";
import { query } from "../_generated/server";

export const checkConnection = query({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const shopifyConnection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		return {
			hasShopify: !!shopifyConnection,
			connection: shopifyConnection,
		};
	},
});
