import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

export const triggerShopifyOrderCreation = internalAction({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		try {
			const result = await ctx.runAction(internal.integrations.shopify.orders.createOrderInternal, {
				orderId: args.orderId,
			});

			if (result.success) {
			} else {
				console.error(`Failed to create Shopify order for ${args.orderId}: ${result.error}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(`Shopify order creation failed for ${args.orderId}: ${message}`);
		}
	},
});
