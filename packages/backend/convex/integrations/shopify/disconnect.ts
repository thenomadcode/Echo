import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";

export const disconnect = action({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		const authResult = await ctx.runQuery(
			internal.integrations.shopify.queries.verifyBusinessOwnership,
			{
				businessId: args.businessId,
			},
		);

		if (!authResult.authorized) {
			return { success: false, error: authResult.error ?? "Not authorized" };
		}

		const connection = await ctx.runQuery(
			internal.integrations.shopify.queries.getConnectionForDisconnect,
			{
				businessId: args.businessId,
			},
		);

		if (!connection) {
			return { success: false, error: "No Shopify connection found" };
		}

		const { shop, accessToken, webhookIds } = connection;

		if (webhookIds && webhookIds.length > 0) {
			for (const webhookId of webhookIds) {
				try {
					await fetch(`https://${shop}/admin/api/2026-01/webhooks/${webhookId}.json`, {
						method: "DELETE",
						headers: {
							"X-Shopify-Access-Token": accessToken,
						},
					});
				} catch (err) {
					console.warn(`Failed to delete webhook ${webhookId}:`, err);
				}
			}
		}

		try {
			await fetch(`https://${shop}/admin/api/2026-01/access_tokens/current.json`, {
				method: "DELETE",
				headers: {
					"X-Shopify-Access-Token": accessToken,
				},
			});
		} catch (err) {
			console.warn("Failed to revoke access token:", err);
		}

		await ctx.runMutation(
			internal.integrations.shopify.mutations.deleteConnectionAndClearProducts,
			{
				businessId: args.businessId,
			},
		);

		return { success: true };
	},
});
