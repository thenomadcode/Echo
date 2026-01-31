import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireBusinessOwnership } from "../lib/auth";
import { generateOrderNumber } from "../lib/orderNumber";

export const create = mutation({
	args: {
		businessId: v.id("businesses"),
		conversationId: v.id("conversations"),
		items: v.array(
			v.object({
				productId: v.id("products"),
				variantId: v.optional(v.id("productVariants")),
				quantity: v.number(),
			}),
		),
		contactPhone: v.string(),
	},
	handler: async (ctx, args) => {
		await requireBusinessOwnership(ctx, args.businessId);

		const orderItems: {
			productId: (typeof args.items)[number]["productId"];
			variantId?: (typeof args.items)[number]["variantId"];
			name: string;
			variantName?: string;
			sku?: string;
			quantity: number;
			unitPrice: number;
			totalPrice: number;
		}[] = [];

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

			let variantData: { name?: string; sku?: string; price: number } | null = null;

			if (item.variantId) {
				const variant = await ctx.db.get(item.variantId);
				if (!variant) {
					throw new Error(`Variant not found: ${item.variantId}`);
				}
				if (variant.productId !== item.productId) {
					throw new Error(`Variant ${item.variantId} does not belong to product ${item.productId}`);
				}
				if (!variant.available) {
					throw new Error(`Variant ${variant.name} is not available`);
				}

				variantData = {
					name: variant.name,
					sku: variant.sku,
					price: variant.price,
				};
			}

			const unitPrice = variantData?.price ?? product.price;

			orderItems.push({
				productId: item.productId,
				variantId: item.variantId,
				name: product.name,
				variantName: variantData?.name,
				sku: variantData?.sku,
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

		return orderId;
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
			items = [
				...order.items,
				{
					productId: args.productId,
					name: product.name,
					quantity,
					unitPrice: product.price,
					totalPrice: product.price * quantity,
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
