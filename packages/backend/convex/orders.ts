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
