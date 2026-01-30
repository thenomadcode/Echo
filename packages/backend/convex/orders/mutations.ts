import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, mutation } from "../_generated/server";
import { requireBusinessOwnership } from "../lib/auth";
import { generateOrderNumber } from "../lib/orderNumber";

/**
 * Match a variant based on a product query string (e.g., "small red", "SKU123")
 * Returns the matched variant or null if no match found
 */
async function matchVariant(
	ctx: MutationCtx,
	productId: Id<"products">,
	productQuery: string,
): Promise<Id<"productVariants"> | null> {
	const variants = await ctx.db
		.query("productVariants")
		.withIndex("by_product", (q) => q.eq("productId", productId))
		.filter((q) => q.eq(q.field("available"), true))
		.collect();

	if (variants.length === 0) {
		return null;
	}

	const query = productQuery.toLowerCase().trim();

	for (const variant of variants) {
		if (variant.sku && variant.sku.toLowerCase() === query) {
			return variant._id;
		}
	}

	for (const variant of variants) {
		if (variant.name?.toLowerCase().includes(query)) {
			return variant._id;
		}
	}

	for (const variant of variants) {
		const optionValues = [
			variant.option1Value?.toLowerCase(),
			variant.option2Value?.toLowerCase(),
			variant.option3Value?.toLowerCase(),
		].filter(Boolean);

		const allOptionsMatch = optionValues.every((opt) => query.includes(opt || ""));
		const queryMatchesAnyOption = optionValues.some((opt) => query.includes(opt || ""));

		if (allOptionsMatch || queryMatchesAnyOption) {
			return variant._id;
		}
	}

	return null;
}

export const create = mutation({
	args: {
		businessId: v.id("businesses"),
		conversationId: v.id("conversations"),
		items: v.array(
			v.object({
				productId: v.id("products"),
				quantity: v.number(),
				productQuery: v.optional(v.string()),
			}),
		),
		contactPhone: v.string(),
	},
	handler: async (ctx, args) => {
		await requireBusinessOwnership(ctx, args.businessId);

		const orderItems: {
			productId: (typeof args.items)[number]["productId"];
			variantId?: Id<"productVariants">;
			name: string;
			variantName?: string;
			sku?: string;
			quantity: number;
			unitPrice: number;
			totalPrice: number;
		}[] = [];

		const variantsToDecrement: Array<{ variantId: Id<"productVariants">; quantity: number }> = [];

		for (const item of args.items) {
			const product = await ctx.db.get(item.productId);
			if (!product) {
				throw new Error(`Product not found: ${item.productId}`);
			}
			if (product.businessId !== args.businessId) {
				throw new Error(`Product ${item.productId} does not belong to this business`);
			}
			if (product.deleted) {
				throw new Error(`Product ${product.name} is no longer available`);
			}

			let unitPrice: number;
			let variantId: Id<"productVariants"> | undefined;
			let variantName: string | undefined;
			let sku: string | undefined;

			if (product.hasVariants) {
				let matchedVariantId: Id<"productVariants"> | null = null;
				if (item.productQuery) {
					matchedVariantId = await matchVariant(ctx, item.productId, item.productQuery);
				}

				if (!matchedVariantId) {
					const firstVariant = await ctx.db
						.query("productVariants")
						.withIndex("by_product", (q) => q.eq("productId", item.productId))
						.filter((q) => q.eq(q.field("available"), true))
						.first();

					if (!firstVariant) {
						throw new Error(`Product ${product.name} has no available variants`);
					}
					matchedVariantId = firstVariant._id;
				}

				const variant = await ctx.db.get(matchedVariantId);
				if (!variant) {
					throw new Error(`Variant not found for product ${product.name}`);
				}

				if (variant.trackInventory) {
					if (variant.inventoryPolicy === "deny" && variant.inventoryQuantity < item.quantity) {
						throw new Error(
							`Insufficient stock for ${product.name}${variant.name ? ` - ${variant.name}` : ""}. Available: ${variant.inventoryQuantity}, requested: ${item.quantity}`,
						);
					}
				}

				unitPrice = variant.price;
				variantId = variant._id;
				variantName = variant.name || undefined;
				sku = variant.sku || undefined;

				if (variant.trackInventory) {
					variantsToDecrement.push({ variantId: variant._id, quantity: item.quantity });
				}
			} else {
				if (product.price === undefined) {
					throw new Error(`Product ${product.name} has no price configured`);
				}
				unitPrice = product.price;
			}

			orderItems.push({
				productId: item.productId,
				variantId,
				name: product.name,
				variantName,
				sku,
				quantity: item.quantity,
				unitPrice,
				totalPrice: unitPrice * item.quantity,
			});
		}

		const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
		const orderNumber = await generateOrderNumber(ctx.db, args.businessId);
		const now = Date.now();

		const firstProduct = orderItems.length > 0 ? await ctx.db.get(orderItems[0].productId) : null;
		const currency = firstProduct?.currency ?? "USD";

		const orderId = await ctx.db.insert("orders", {
			businessId: args.businessId,
			conversationId: args.conversationId,
			orderNumber,
			status: "draft",
			items: orderItems,
			subtotal,
			total: subtotal,
			currency,
			deliveryType: "pickup",
			contactPhone: args.contactPhone,
			paymentMethod: "cash",
			paymentStatus: "pending",
			createdAt: now,
			updatedAt: now,
		});

		await ctx.scheduler.runAfter(0, internal.orders.mutations.decrementInventory, {
			variants: variantsToDecrement,
		});

		return orderId;
	},
});

/**
 * Internal mutation to decrement inventory after order creation
 */
export const decrementInventory = internalMutation({
	args: {
		variants: v.array(
			v.object({
				variantId: v.id("productVariants"),
				quantity: v.number(),
			}),
		),
	},
	handler: async (ctx, args) => {
		for (const { variantId, quantity } of args.variants) {
			try {
				await ctx.runMutation(internal.variants.decrementStock, {
					variantId,
					quantity,
				});
			} catch (error) {
				console.error(`Failed to decrement stock for variant ${variantId}:`, error);
			}
		}
	},
});

export const addItem = mutation({
	args: {
		orderId: v.id("orders"),
		productId: v.id("products"),
		quantity: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);
		if (order.status !== "draft") {
			throw new Error("Can only add items to draft orders");
		}

		const product = await ctx.db.get(args.productId);
		if (!product) {
			throw new Error("Product not found");
		}
		if (product.businessId !== order.businessId) {
			throw new Error("Product does not belong to this business");
		}
		if (product.deleted) {
			throw new Error(`Product ${product.name} is no longer available`);
		}

		const quantity = args.quantity ?? 1;
		const existingIndex = order.items.findIndex((item) => item.productId === args.productId);

		let items: typeof order.items;
		if (existingIndex >= 0) {
			items = order.items.map((item, idx) =>
				idx === existingIndex
					? {
							...item,
							quantity: item.quantity + quantity,
							totalPrice: item.unitPrice * (item.quantity + quantity),
						}
					: item,
			);
		} else {
			let unitPrice: number;
			if (product.hasVariants) {
				const defaultVariant = await ctx.db
					.query("productVariants")
					.withIndex("by_product", (q) => q.eq("productId", args.productId))
					.first();

				if (!defaultVariant || !defaultVariant.available) {
					throw new Error(`Product ${product.name} has no available variants`);
				}

				unitPrice = defaultVariant.price;
			} else {
				if (product.price === undefined) {
					throw new Error(`Product ${product.name} has no price configured`);
				}
				unitPrice = product.price;
			}

			items = [
				...order.items,
				{
					productId: args.productId,
					name: product.name,
					quantity,
					unitPrice,
					totalPrice: unitPrice * quantity,
				},
			];
		}

		const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
		const total = subtotal + (order.deliveryFee ?? 0);

		await ctx.db.patch(args.orderId, {
			items,
			subtotal,
			total,
			updatedAt: Date.now(),
		});

		return args.orderId;
	},
});

export const removeItem = mutation({
	args: {
		orderId: v.id("orders"),
		productId: v.id("products"),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);
		if (order.status !== "draft") {
			throw new Error("Can only remove items from draft orders");
		}

		const items = order.items.filter((item) => item.productId !== args.productId);

		const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
		const total = subtotal + (order.deliveryFee ?? 0);

		await ctx.db.patch(args.orderId, {
			items,
			subtotal,
			total,
			updatedAt: Date.now(),
		});

		return args.orderId;
	},
});

export const updateItemQuantity = mutation({
	args: {
		orderId: v.id("orders"),
		productId: v.id("products"),
		quantity: v.number(),
	},
	handler: async (ctx, args) => {
		const order = await ctx.db.get(args.orderId);
		if (!order) {
			throw new Error("Order not found");
		}
		await requireBusinessOwnership(ctx, order.businessId);
		if (order.status !== "draft") {
			throw new Error("Can only update items in draft orders");
		}

		let items: typeof order.items;
		if (args.quantity <= 0) {
			items = order.items.filter((item) => item.productId !== args.productId);
		} else {
			items = order.items.map((item) =>
				item.productId === args.productId
					? {
							...item,
							quantity: args.quantity,
							totalPrice: item.unitPrice * args.quantity,
						}
					: item,
			);
		}

		const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
		const total = subtotal + (order.deliveryFee ?? 0);

		await ctx.db.patch(args.orderId, {
			items,
			subtotal,
			total,
			updatedAt: Date.now(),
		});

		return args.orderId;
	},
});
