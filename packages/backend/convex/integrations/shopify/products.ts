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

		const { shop, accessToken } = connection;
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

					const shopifyProductId = product.id;
					const hasVariants = product.variants.edges.length > 1;

					try {
						const { productId } = await ctx.runMutation(
							internal.integrations.shopify.mutations.upsertParentProduct,
							{
								businessId: args.businessId,
								externalProductId: shopifyProductId,
								name: product.title,
								description: product.descriptionHtml || undefined,
								hasVariants,
								available: product.variants.edges.some((v) => v.node.inventoryQuantity > 0),
							},
						);

						for (const variantEdge of product.variants.edges) {
							const variant = variantEdge.node;
							const selectedOptions = variant.selectedOptions;

							const option1 = selectedOptions[0];
							const option2 = selectedOptions[1];
							const option3 = selectedOptions[2];

							const optionParts: string[] = [];
							if (option1?.value && option1.value !== "Default Title")
								optionParts.push(option1.value);
							if (option2?.value) optionParts.push(option2.value);
							if (option3?.value) optionParts.push(option3.value);

							const variantName = optionParts.join(" / ");

							const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
							const compareAtPriceInCents = variant.compareAtPrice
								? Math.round(Number.parseFloat(variant.compareAtPrice) * 100)
								: undefined;

							const inventoryPolicy =
								variant.inventoryPolicy === "CONTINUE" ? ("continue" as const) : ("deny" as const);

							const weightUnit = variant.weightUnit?.toLowerCase() as
								| "kg"
								| "g"
								| "lb"
								| "oz"
								| undefined;

							await ctx.runMutation(internal.integrations.shopify.mutations.upsertProductVariant, {
								productId,
								externalVariantId: variant.id,
								name: variantName,
								sku: variant.sku || undefined,
								barcode: variant.barcode || undefined,
								price: priceInCents,
								compareAtPrice: compareAtPriceInCents,
								inventoryQuantity: variant.inventoryQuantity,
								inventoryPolicy,
								option1Name: option1?.name,
								option1Value: option1?.value,
								option2Name: option2?.name,
								option2Value: option2?.value,
								option3Name: option3?.name,
								option3Value: option3?.value,
								weight: variant.weight ?? undefined,
								weightUnit,
								requiresShipping: variant.requiresShipping,
								position: variant.position,
							});
						}

						imported++;
					} catch (err) {
						const msg = err instanceof Error ? err.message : "Unknown error";
						errors.push(`Failed to import "${product.title}": ${msg}`);
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

		const { shop, accessToken } = connection;
		let updated = 0;
		let added = 0;
		let removed = 0;
		const errors: string[] = [];
		const seenExternalVariantIds = new Set<string>();

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
							seenExternalVariantIds.add(variantEdge.node.id);
						}
						continue;
					}

					const shopifyProductId = product.id;
					const hasVariants = product.variants.edges.length > 1;

					try {
						const { productId, isNew: isProductNew } = await ctx.runMutation(
							internal.integrations.shopify.mutations.upsertParentProduct,
							{
								businessId: args.businessId,
								externalProductId: shopifyProductId,
								name: product.title,
								description: product.descriptionHtml || undefined,
								hasVariants,
								available: product.variants.edges.some((v) => v.node.inventoryQuantity > 0),
							},
						);

						if (isProductNew) {
							added++;
						}

						for (const variantEdge of product.variants.edges) {
							const variant = variantEdge.node;
							seenExternalVariantIds.add(variant.id);

							const selectedOptions = variant.selectedOptions;

							const option1 = selectedOptions[0];
							const option2 = selectedOptions[1];
							const option3 = selectedOptions[2];

							const optionParts: string[] = [];
							if (option1?.value && option1.value !== "Default Title")
								optionParts.push(option1.value);
							if (option2?.value) optionParts.push(option2.value);
							if (option3?.value) optionParts.push(option3.value);

							const variantName = optionParts.join(" / ");

							const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
							const compareAtPriceInCents = variant.compareAtPrice
								? Math.round(Number.parseFloat(variant.compareAtPrice) * 100)
								: undefined;

							const inventoryPolicy =
								variant.inventoryPolicy === "CONTINUE" ? ("continue" as const) : ("deny" as const);

							const weightUnit = variant.weightUnit?.toLowerCase() as
								| "kg"
								| "g"
								| "lb"
								| "oz"
								| undefined;

							const { isNew: isVariantNew } = await ctx.runMutation(
								internal.integrations.shopify.mutations.upsertProductVariant,
								{
									productId,
									externalVariantId: variant.id,
									name: variantName,
									sku: variant.sku || undefined,
									barcode: variant.barcode || undefined,
									price: priceInCents,
									compareAtPrice: compareAtPriceInCents,
									inventoryQuantity: variant.inventoryQuantity,
									inventoryPolicy,
									option1Name: option1?.name,
									option1Value: option1?.value,
									option2Name: option2?.name,
									option2Value: option2?.value,
									option3Name: option3?.name,
									option3Value: option3?.value,
									weight: variant.weight ?? undefined,
									weightUnit,
									requiresShipping: variant.requiresShipping,
									position: variant.position,
								},
							);

							if (!isProductNew && !isVariantNew) {
								updated++;
							}
						}
					} catch (err) {
						const msg = err instanceof Error ? err.message : "Unknown error";
						errors.push(`Failed to sync "${product.title}": ${msg}`);
					}
				}

				hasNextPage = products.pageInfo.hasNextPage;
				cursor = products.pageInfo.endCursor;
			}

			const removedCount = await ctx.runMutation(
				internal.integrations.shopify.mutations.markMissingVariantsUnavailable,
				{
					businessId: args.businessId,
					seenExternalVariantIds: Array.from(seenExternalVariantIds),
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
