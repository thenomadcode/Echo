import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { generateOrderNumber } from "./lib/orderNumber";
import { authComponent } from "./auth";

type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

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

export const get = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      return null;
    }

    const business = await ctx.db.get(order.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return null;
    }

    return order;
  },
});

export const getByConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const business = await ctx.db.get(conversation.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return null;
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .first();

    return orders;
  },
});

export const getByOrderNumber = query({
  args: {
    orderNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const order = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("orderNumber", args.orderNumber))
      .first();

    if (!order) {
      return null;
    }

    const business = await ctx.db.get(order.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return null;
    }

    return order;
  },
});

export const listByBusiness = query({
  args: {
    businessId: v.id("businesses"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("confirmed"),
        v.literal("paid"),
        v.literal("preparing"),
        v.literal("ready"),
        v.literal("delivered"),
        v.literal("cancelled")
      )
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return { orders: [], nextCursor: null };
    }

    const business = await ctx.db.get(args.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return { orders: [], nextCursor: null };
    }

    const limit = args.limit ?? 50;

    let ordersQuery = ctx.db
      .query("orders")
      .withIndex("by_business", (q) => {
        if (args.status) {
          return q.eq("businessId", args.businessId).eq("status", args.status);
        }
        return q.eq("businessId", args.businessId);
      })
      .order("desc");

    const orders = await ordersQuery.take(limit + 1);

    const hasMore = orders.length > limit;
    const page = hasMore ? orders.slice(0, limit) : orders;
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1]._id : null;

    return {
      orders: page,
      nextCursor,
    };
  },
});

export const updatePaymentLink = mutation({
  args: {
    orderId: v.id("orders"),
    stripeSessionId: v.string(),
    paymentLinkUrl: v.string(),
    paymentLinkExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      stripeSessionId: args.stripeSessionId,
      paymentLinkUrl: args.paymentLinkUrl,
      paymentLinkExpiresAt: args.paymentLinkExpiresAt,
      updatedAt: Date.now(),
    });
  },
});

export const generatePaymentLink = action({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args): Promise<string> => {
    const order = await ctx.runQuery(internal.orders.getOrderForPayment, {
      orderId: args.orderId,
    });

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.items.length === 0) {
      throw new Error("Order has no items");
    }

    const now = Date.now();
    const isExpired = order.paymentLinkExpiresAt && order.paymentLinkExpiresAt < now;
    if (order.status !== "draft" && !isExpired) {
      throw new Error("Payment link can only be generated for draft orders or expired links");
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
    }

    const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";

    const params: Record<string, string> = {
      mode: "payment",
      [`metadata[orderId]`]: args.orderId,
      success_url: `${baseUrl}/dashboard/orders/${args.orderId}?payment=success`,
      cancel_url: `${baseUrl}/dashboard/orders/${args.orderId}?payment=cancelled`,
    };

    order.items.forEach((item: OrderItem, idx: number) => {
      params[`line_items[${idx}][price_data][currency]`] = order.currency.toLowerCase();
      params[`line_items[${idx}][price_data][product_data][name]`] = item.name;
      params[`line_items[${idx}][price_data][unit_amount]`] = item.unitPrice.toString();
      params[`line_items[${idx}][quantity]`] = item.quantity.toString();
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to create payment session";
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(`Stripe error: ${errorMessage}`);
    }

    const session = (await response.json()) as {
      id: string;
      url: string;
    };

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    const expiresAt = now + 24 * 60 * 60 * 1000;

    await ctx.runMutation(internal.orders.updatePaymentLinkInternal, {
      orderId: args.orderId,
      stripeSessionId: session.id,
      paymentLinkUrl: session.url,
      paymentLinkExpiresAt: expiresAt,
    });

    return session.url;
  },
});

export const getOrderForPayment = internalQuery({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orderId);
  },
});

export const updatePaymentLinkInternal = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripeSessionId: v.string(),
    paymentLinkUrl: v.string(),
    paymentLinkExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      stripeSessionId: args.stripeSessionId,
      paymentLinkUrl: args.paymentLinkUrl,
      paymentLinkExpiresAt: args.paymentLinkExpiresAt,
      updatedAt: Date.now(),
    });
  },
});