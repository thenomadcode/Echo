import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { action, mutation } from "../../_generated/server";
import { requireAuth, requireBusinessOwnership } from "../../lib/auth";
import type { ShopifyErrorResponse, ShopifyTokenResponse } from "./types";
import { generateStateParameter, normalizeShopUrl } from "./utils";

export const getAuthUrl = mutation({
	args: {
		businessId: v.id("businesses"),
		shop: v.string(),
	},
	handler: async (ctx, args) => {
		await requireAuth(ctx);
		await requireBusinessOwnership(ctx, args.businessId);

		const normalizedShop = normalizeShopUrl(args.shop);
		if (!normalizedShop) {
			throw new Error(
				"Invalid shop URL. Must be a valid Shopify store (e.g., mystore or mystore.myshopify.com)",
			);
		}

		const existingConnection = await ctx.db
			.query("shopifyConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();
		if (existingConnection) {
			throw new Error("This business already has a Shopify connection");
		}

		const clientId = process.env.SHOPIFY_API_KEY;
		const scopes = process.env.SHOPIFY_SCOPES ?? "read_products,write_orders,read_orders";
		const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL;

		if (!clientId) {
			throw new Error("Shopify API key not configured");
		}
		if (!siteUrl) {
			throw new Error("Site URL not configured");
		}

		const state = generateStateParameter();
		const stateData = `${state}|${args.businessId}`;

		const redirectUri = `${siteUrl}/shopify/callback`;
		const authUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
		authUrl.searchParams.set("client_id", clientId);
		authUrl.searchParams.set("scope", scopes);
		authUrl.searchParams.set("redirect_uri", redirectUri);
		authUrl.searchParams.set("state", stateData);

		return {
			authUrl: authUrl.toString(),
			shop: normalizedShop,
		};
	},
});

export const handleCallback = action({
	args: {
		code: v.string(),
		shop: v.string(),
		state: v.string(),
	},
	handler: async (
		ctx,
		args,
	): Promise<{ success: boolean; error?: string; businessId?: string }> => {
		const stateParts = args.state.split("|");
		if (stateParts.length !== 2) {
			return { success: false, error: "Invalid state parameter" };
		}

		const [, businessIdStr] = stateParts;
		const businessId = businessIdStr as Id<"businesses">;

		const normalizedShop = normalizeShopUrl(args.shop);
		if (!normalizedShop) {
			return { success: false, error: "Invalid shop URL" };
		}

		const clientId = process.env.SHOPIFY_API_KEY;
		const clientSecret = process.env.SHOPIFY_API_SECRET;

		if (!clientId || !clientSecret) {
			return { success: false, error: "Shopify credentials not configured" };
		}

		try {
			const tokenResponse = await fetch(`https://${normalizedShop}/admin/oauth/access_token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					client_id: clientId,
					client_secret: clientSecret,
					code: args.code,
				}),
			});

			if (!tokenResponse.ok) {
				const errorData = (await tokenResponse.json()) as ShopifyErrorResponse;
				const errorMessage =
					errorData.error_description || errorData.error || "Token exchange failed";
				return { success: false, error: errorMessage };
			}

			const tokenData = (await tokenResponse.json()) as ShopifyTokenResponse;
			const scopes = tokenData.scope.split(",").map((s) => s.trim());

			await ctx.runMutation(internal.integrations.shopify.mutations.saveConnection, {
				businessId,
				shop: normalizedShop,
				accessToken: tokenData.access_token,
				scopes,
			});

			const webhookResult = await ctx.runAction(
				internal.integrations.shopify.webhooks.registerWebhooks,
				{
					businessId,
				},
			);

			if (!webhookResult.success) {
				console.warn(`Webhook registration had issues: ${webhookResult.errors.join(", ")}`);
			}

			return { success: true, businessId };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return { success: false, error: message };
		}
	},
});
