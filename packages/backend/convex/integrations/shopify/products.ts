import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import type { ImportResult, ShopifyGraphQLResponse, SyncResult } from "./types";
import { SHOPIFY_PRODUCTS_QUERY, downloadAndStoreImage } from "./utils";

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
				const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
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
					const currency =
						business.defaultLanguage === "es"
							? "COP"
							: business.defaultLanguage === "pt"
								? "BRL"
								: "USD";

					let productImageId: string | undefined;
					if (product.images.edges[0]?.node.url) {
						const imageUrl = product.images.edges[0].node.url;
						const storageId = await downloadAndStoreImage(ctx, imageUrl);
						if (storageId) {
							productImageId = storageId;
						}
					}

					const hasVariants = product.variants.edges.length > 1;
					const variants = [];

					for (let i = 0; i < product.variants.edges.length; i++) {
						const variantEdge = product.variants.edges[i];
						if (!variantEdge) continue;

						const variant = variantEdge.node;
						const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
						const compareAtPriceInCents = variant.compareAtPrice
							? Math.round(Number.parseFloat(variant.compareAtPrice) * 100)
							: undefined;

						let variantImageId: string | undefined;
						if (variant.image?.url) {
							const storageId = await downloadAndStoreImage(ctx, variant.image.url);
							if (storageId) {
								variantImageId = storageId;
							}
						}

						const option1 = variant.selectedOptions[0];
						const option2 = variant.selectedOptions[1];
						const option3 = variant.selectedOptions[2];

						const variantName =
							hasVariants && variant.title !== "Default Title" ? variant.title : "";

						const weightData = variant.inventoryItem?.measurement?.weight;
						const weightInGrams = weightData?.value
							? weightData.unit === "KILOGRAMS"
								? weightData.value * 1000
								: weightData.unit === "POUNDS"
									? weightData.value * 453.592
									: weightData.unit === "OUNCES"
										? weightData.value * 28.3495
										: weightData.value
							: undefined;

						const weightUnit = weightInGrams ? ("g" as const) : undefined;

						variants.push({
							externalVariantId: variant.id,
							name: variantName,
							sku: variant.sku ?? undefined,
							barcode: variant.barcode ?? undefined,
							price: priceInCents,
							compareAtPrice: compareAtPriceInCents,
							inventoryQuantity: variant.inventoryQuantity,
							available: variant.availableForSale,
							option1Name: option1?.name,
							option1Value: option1?.value,
							option2Name: option2?.name,
							option2Value: option2?.value,
							option3Name: option3?.name,
							option3Value: option3?.value,
							imageId: variantImageId,
							weight: weightInGrams,
							weightUnit: weightUnit,
							requiresShipping: variant.inventoryItem?.requiresShipping,
							position: variant.position,
						});
					}

					try {
						await ctx.runMutation(
							internal.integrations.shopify.mutations.upsertProductWithVariants,
							{
								businessId: args.businessId,
								externalProductId,
								name: product.title,
								description: product.descriptionHtml || undefined,
								imageId: productImageId,
								currency,
								hasVariants,
								variants,
							},
						);
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
			const errorMessage = errors.length > 0 ? errors.join("; ") : undefined;
			await ctx.runMutation(internal.integrations.shopify.mutations.updateSyncStatus, {
				businessId: args.businessId,
				status,
				errorMessage,
			});

			return { imported, skipped, errors };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			const allErrors = [...errors, message];
			await ctx.runMutation(internal.integrations.shopify.mutations.updateSyncStatus, {
				businessId: args.businessId,
				status: "failed",
				errorMessage: allErrors.join("; "),
			});
			return { imported, skipped, errors: allErrors };
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
		const removed = 0;
		const errors: string[] = [];

		let hasNextPage = true;
		let cursor: string | null = null;

		try {
			while (hasNextPage) {
				const response = await fetch(`https://${shop}/admin/api/2026-01/graphql.json`, {
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
						continue;
					}

					const externalProductId = product.id;
					const currency =
						business.defaultLanguage === "es"
							? "COP"
							: business.defaultLanguage === "pt"
								? "BRL"
								: "USD";

					let productImageId: string | undefined;
					if (product.images.edges[0]?.node.url) {
						const imageUrl = product.images.edges[0].node.url;
						const storageId = await downloadAndStoreImage(ctx, imageUrl);
						if (storageId) {
							productImageId = storageId;
						}
					}

					const hasVariants = product.variants.edges.length > 1;
					const variants = [];

					for (let i = 0; i < product.variants.edges.length; i++) {
						const variantEdge = product.variants.edges[i];
						if (!variantEdge) continue;

						const variant = variantEdge.node;
						const priceInCents = Math.round(Number.parseFloat(variant.price) * 100);
						const compareAtPriceInCents = variant.compareAtPrice
							? Math.round(Number.parseFloat(variant.compareAtPrice) * 100)
							: undefined;

						let variantImageId: string | undefined;
						if (variant.image?.url) {
							const storageId = await downloadAndStoreImage(ctx, variant.image.url);
							if (storageId) {
								variantImageId = storageId;
							}
						}

						const option1 = variant.selectedOptions[0];
						const option2 = variant.selectedOptions[1];
						const option3 = variant.selectedOptions[2];

						const variantName =
							hasVariants && variant.title !== "Default Title" ? variant.title : "";

						const weightData = variant.inventoryItem?.measurement?.weight;
						const weightInGrams = weightData?.value
							? weightData.unit === "KILOGRAMS"
								? weightData.value * 1000
								: weightData.unit === "POUNDS"
									? weightData.value * 453.592
									: weightData.unit === "OUNCES"
										? weightData.value * 28.3495
										: weightData.value
							: undefined;

						const weightUnit = weightInGrams ? ("g" as const) : undefined;

						variants.push({
							externalVariantId: variant.id,
							name: variantName,
							sku: variant.sku ?? undefined,
							barcode: variant.barcode ?? undefined,
							price: priceInCents,
							compareAtPrice: compareAtPriceInCents,
							inventoryQuantity: variant.inventoryQuantity,
							available: variant.availableForSale,
							option1Name: option1?.name,
							option1Value: option1?.value,
							option2Name: option2?.name,
							option2Value: option2?.value,
							option3Name: option3?.name,
							option3Value: option3?.value,
							imageId: variantImageId,
							weight: weightInGrams,
							weightUnit: weightUnit,
							requiresShipping: variant.inventoryItem?.requiresShipping,
							position: variant.position,
						});
					}

					try {
						const syncResult = await ctx.runMutation(
							internal.integrations.shopify.mutations.upsertProductWithVariants,
							{
								businessId: args.businessId,
								externalProductId,
								name: product.title,
								description: product.descriptionHtml || undefined,
								imageId: productImageId,
								currency,
								hasVariants,
								variants,
							},
						);

						if (syncResult.isNew) {
							added++;
						} else {
							updated++;
						}
					} catch (err) {
						const msg = err instanceof Error ? err.message : "Unknown error";
						errors.push(`Failed to sync "${product.title}": ${msg}`);
					}
				}

				hasNextPage = products.pageInfo.hasNextPage;
				cursor = products.pageInfo.endCursor;
			}

			const status =
				errors.length === 0 ? "success" : updated + added + removed > 0 ? "partial" : "failed";
			const errorMessage = errors.length > 0 ? errors.join("; ") : undefined;
			await ctx.runMutation(internal.integrations.shopify.mutations.updateSyncStatus, {
				businessId: args.businessId,
				status,
				errorMessage,
			});

			return { updated, added, removed, errors };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			const allErrors = [...errors, message];
			await ctx.runMutation(internal.integrations.shopify.mutations.updateSyncStatus, {
				businessId: args.businessId,
				status: "failed",
				errorMessage: allErrors.join("; "),
			});
			return { updated, added, removed, errors: allErrors };
		}
	},
});
