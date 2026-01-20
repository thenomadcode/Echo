import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { generateOrderNumber } from "./lib/orderNumber";

export const create = mutation({
  args: {
    businessId: v.id("businesses"),
    conversationId: v.id("conversations"),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
      })
    ),
    contactPhone: v.string(),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    const orderItems: {
      productId: typeof args.items[number]["productId"];
      name: string;
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

      orderItems.push({
        productId: item.productId,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: product.price * item.quantity,
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
    const existingIndex = order.items.findIndex(
      (item) => item.productId === args.productId
    );

    let items: typeof order.items;
    if (existingIndex >= 0) {
      items = order.items.map((item, idx) =>
        idx === existingIndex
          ? {
              ...item,
              quantity: item.quantity + quantity,
              totalPrice: item.unitPrice * (item.quantity + quantity),
            }
          : item
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
          : item
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

export const setDeliveryInfo = mutation({
  args: {
    orderId: v.id("orders"),
    deliveryType: v.union(v.literal("delivery"), v.literal("pickup")),
    deliveryAddress: v.optional(v.string()),
    deliveryNotes: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (args.deliveryType === "delivery" && !args.deliveryAddress) {
      throw new Error("Delivery address is required for delivery orders");
    }

    const updates: Record<string, unknown> = {
      deliveryType: args.deliveryType,
      deliveryNotes: args.deliveryNotes,
      updatedAt: Date.now(),
    };

    if (args.deliveryType === "delivery") {
      updates.deliveryAddress = args.deliveryAddress;
    } else {
      updates.deliveryAddress = undefined;
    }

    if (args.contactPhone !== undefined) {
      updates.contactPhone = args.contactPhone;
    }

    await ctx.db.patch(args.orderId, updates);

    return args.orderId;
  },
});

export const setPaymentMethod = mutation({
  args: {
    orderId: v.id("orders"),
    paymentMethod: v.union(v.literal("card"), v.literal("cash")),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const updates: Record<string, unknown> = {
      paymentMethod: args.paymentMethod,
      updatedAt: Date.now(),
    };

    if (args.paymentMethod === "cash") {
      updates.status = "confirmed";
    }

    await ctx.db.patch(args.orderId, updates);

    return args.orderId;
  },
});

export const cancel = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const nonCancellableStatuses = ["paid", "preparing", "ready", "delivered"];
    if (nonCancellableStatuses.includes(order.status)) {
      throw new Error("Order already paid, requires manual refund");
    }

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: args.reason,
      updatedAt: now,
    });

    return args.orderId;
  },
});

export const markPreparing = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "confirmed" && order.status !== "paid") {
      throw new Error("Order must be confirmed or paid to start preparing");
    }

    await ctx.db.patch(args.orderId, {
      status: "preparing",
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.orderId);
  },
});

export const markReady = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "preparing") {
      throw new Error("Order must be preparing to mark as ready");
    }

    await ctx.db.patch(args.orderId, {
      status: "ready",
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.orderId);
  },
});

export const markDelivered = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status !== "ready") {
      throw new Error("Order must be ready to mark as delivered");
    }

    await ctx.db.patch(args.orderId, {
      status: "delivered",
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.orderId);
  },
});
