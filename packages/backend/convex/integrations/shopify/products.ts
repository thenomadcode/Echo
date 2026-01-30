import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import type { ImportResult, ShopifyGraphQLResponse, SyncResult } from "./types";
import { SHOPIFY_PRODUCTS_QUERY } from "./utils";

export const importProducts = action({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<ImportResult> => {
		const authResult = await ctx.runQuery(
			internal.integrations.shopify.queries.verifyBusinessOwnership,
			{
				businessId: args.businessId,
			},
		);

		if (!authResult.authorized) {
			return { imported: 0, skipped: 0, errors: [authResult.error ?? "Not authorized"] };
		}

		const connection = await ctx.runQuery(
			internal.integrations.shopify.queries.getConnectionInternal,
			{
				businessId: args.businessId,
			},
		);

		if (!connection) {
			return { imported: 0, skipped: 0, errors: ["No Shopify connection found"] };
		}

		const { shop, accessToken, business } = connection;
		let imported = 0;
		let skipped = 0;
		const errors: string[] = [];
		let hasNextPage = true;
		let cursor: string | null = null;

		try {
			while (hasNextPage) {
				const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Shopify-Access-Token": accessToken,
					},
					body: JSON.stringify({
						query: SHOPIFY_PRODUCTS_QUERY,
						variables: { first: 50, after: cursor },
					}),
				});

				if (!response.ok) {
					errors.push(`API error: ${response.status} ${response.statusText}`);
					break;
				}

				const result = (await response.json()) as ShopifyGraphQLResponse;

				if (result.errors) {
					errors.push(...result.errors.map((e) => e.message));
					break;
				}

				if (!result.data) {
					errors.push("No data returned from Shopify");
					break;
				}

				const products = result.data.products;

				for (const edge of products.edges) {
					const product = edge.node;

					if (product.status !== "ACTIVE") {
						skipped++;
						continue;
					}

					const externalProductId = product.id;
					const imageUrl = product.images.edges[0]?.node.url ?? null;

					for (const variantEdge of product.variants.edges) {
						const variant = variantEdge.node;
						const isOnlyVariant = product.variants.edges.length === 1;
						const variantTitle =
							isOnlyVariant || variant.title === "Default Title" ? "" : variant.title;

						const name = variantTitle ? `${product.title} - ${variantTitle}` : product.title;

						const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
						const available = variant.inventoryQuantity > 0;

						try {
							await ctx.runMutation(internal.integrations.shopify.mutations.upsertProduct, {
								businessId: args.businessId,
								externalProductId,
								shopifyVariantId: variant.id,
								name,
								description: product.descriptionHtml || undefined,
								price: priceInCents,
								currency:
									business.defaultLanguage === "es"
										? "COP"
										: business.defaultLanguage === "pt"
											? "BRL"
											: "USD",
								imageUrl: imageUrl ?? undefined,
								available,
							});
							imported++;
						} catch (err) {
							const msg = err instanceof Error ? err.message : "Unknown error";
							errors.push(`Failed to import "${name}": ${msg}`);
						}
					}
				}

				hasNextPage = products.pageInfo.hasNextPage;
				cursor = products.pageInfo.endCursor;
			}

			const status = errors.length === 0 ? "success" : imported > 0 ? "partial" : "failed";
			await ctx.runMutation(internal.integrations.shopify.mutations.updateSyncStatus, {
				businessId: args.businessId,
				status,
			});

			return { imported, skipped, errors };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			await ctx.runMutation(internal.integrations.shopify.mutations.updateSyncStatus, {
				businessId: args.businessId,
				status: "failed",
			});
			return { imported, skipped, errors: [...errors, message] };
		}
	},
});

export const syncProducts = action({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<SyncResult> => {
		const authResult = await ctx.runQuery(
			internal.integrations.shopify.queries.verifyBusinessOwnership,
			{
				businessId: args.businessId,
			},
		);

		if (!authResult.authorized) {
			return { updated: 0, added: 0, removed: 0, errors: [authResult.error ?? "Not authorized"] };
		}

		const connection = await ctx.runQuery(
			internal.integrations.shopify.queries.getConnectionInternal,
			{
				businessId: args.businessId,
			},
		);

		if (!connection) {
			return { updated: 0, added: 0, removed: 0, errors: ["No Shopify connection found"] };
		}

		const { shop, accessToken, business } = connection;
		let updated = 0;
		let added = 0;
		let removed = 0;
		const errors: string[] = [];
		const seenShopifyVariantIds = new Set<string>();

		let hasNextPage = true;
		let cursor: string | null = null;

		try {
			while (hasNextPage) {
				const response = await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Shopify-Access-Token": accessToken,
					},
					body: JSON.stringify({
						query: SHOPIFY_PRODUCTS_QUERY,
						variables: { first: 50, after: cursor },
					}),
				});

				if (!response.ok) {
					errors.push(`API error: ${response.status} ${response.statusText}`);
					break;
				}

				const result = (await response.json()) as ShopifyGraphQLResponse;

				if (result.errors) {
					errors.push(...result.errors.map((e) => e.message));
					break;
				}

				if (!result.data) {
					errors.push("No data returned from Shopify");
					break;
				}

				const products = result.data.products;

				for (const edge of products.edges) {
					const product = edge.node;

					if (product.status !== "ACTIVE") {
						for (const variantEdge of product.variants.edges) {
							seenShopifyVariantIds.add(variantEdge.node.id);
						}
						continue;
					}

					const externalProductId = product.id;
					const imageUrl = product.images.edges[0]?.node.url ?? null;

					for (const variantEdge of product.variants.edges) {
						const variant = variantEdge.node;
						seenShopifyVariantIds.add(variant.id);

						const isOnlyVariant = product.variants.edges.length === 1;
						const variantTitle =
							isOnlyVariant || variant.title === "Default Title" ? "" : variant.title;

						const name = variantTitle ? `${product.title} - ${variantTitle}` : product.title;

						const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
						const available = variant.inventoryQuantity > 0;

						try {
							const syncResult = await ctx.runMutation(
								internal.integrations.shopify.mutations.upsertProductWithStats,
								{
									businessId: args.businessId,
									externalProductId,
									shopifyVariantId: variant.id,
									name,
									description: product.descriptionHtml || undefined,
									price: priceInCents,
									currency:
										business.defaultLanguage === "es"
											? "COP"
											: business.defaultLanguage === "pt"
												? "BRL"
												: "USD",
									imageUrl: imageUrl ?? undefined,
									available,
								},
							);

							if (syncResult.isNew) {
								added++;
							} else {
								updated++;
							}
						} catch (err) {
							const msg = err instanceof Error ? err.message : "Unknown error";
							errors.push(`Failed to sync "${name}": ${msg}`);
						}
					}
				}

				hasNextPage = products.pageInfo.hasNextPage;
				cursor = products.pageInfo.endCursor;
			}

			const removedCount = await ctx.runMutation(
				internal.integrations.shopify.mutations.markMissingProductsUnavailable,
				{
					businessId: args.businessId,
					seenShopifyVariantIds: Array.from(seenShopifyVariantIds),
				},
			);
			removed = removedCount;

			const status =
				errors.length === 0 ? "success" : updated + added + removed > 0 ? "partial" : "failed";
			await ctx.runMutation(internal.integrations.shopify.mutations.updateSyncStatus, {
				businessId: args.businessId,
				status,
			});

			return { updated, added, removed, errors };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			await ctx.runMutation(internal.integrations.shopify.mutations.updateSyncStatus, {
				businessId: args.businessId,
				status: "failed",
			});
			return { updated, added, removed, errors: [...errors, message] };
		}
	},
});
