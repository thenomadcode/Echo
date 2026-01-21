import { v } from "convex/values";
import { query } from "./_generated/server";
import { authComponent } from "./auth";

export const getMetrics = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return null;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const currentWeekStart = new Date();
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);
    const currentWeekStartMs = currentWeekStart.getTime();

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekStartMs = previousWeekStart.getTime();

    const activeConversations = await ctx.db
      .query("conversations")
      .withIndex("by_business_status", (q) =>
        q.eq("businessId", args.businessId).eq("status", "active")
      )
      .collect();

    const escalatedConversations = await ctx.db
      .query("conversations")
      .withIndex("by_business_status", (q) =>
        q.eq("businessId", args.businessId).eq("status", "escalated")
      )
      .collect();

    const allOrders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const ordersToday = allOrders.filter(
      (order) => order.createdAt >= todayStartMs && order.status !== "cancelled"
    );
    const revenueToday = ordersToday.reduce((sum, order) => sum + order.total, 0);

    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();

    const currentWeekConversations = allConversations.filter(
      (conv) => conv.createdAt >= currentWeekStartMs
    );

    const previousWeekConversations = allConversations.filter(
      (conv) =>
        conv.createdAt >= previousWeekStartMs &&
        conv.createdAt < currentWeekStartMs
    );
    const previousWeekCount = previousWeekConversations.length;

    let weeklyChange = 0;
    if (previousWeekCount > 0) {
      weeklyChange = Math.round(
        ((currentWeekConversations.length - previousWeekCount) / previousWeekCount) * 100
      );
    } else if (currentWeekConversations.length > 0) {
      weeklyChange = 100;
    }

    return {
      activeConversations: activeConversations.length,
      escalatedCount: escalatedConversations.length,
      ordersToday: ordersToday.length,
      revenueToday,
      weeklyConversations: currentWeekConversations.length,
      weeklyChange,
    };
  },
});

export const getActivity = query({
  args: {
    businessId: v.id("businesses"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return [];
    }

    const business = await ctx.db.get(args.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return [];
    }

    const limit = args.limit ?? 5;

    const recentConversations = await ctx.db
      .query("conversations")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .take(50);

    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .take(50);

    const activities: Array<{
      type: "conversation" | "order";
      description: string;
      timestamp: number;
      link: string;
    }> = [];

    for (const conv of recentConversations) {
      const customerDisplay = conv.customerId.slice(-4);
      let description: string;

      if (conv.status === "escalated") {
        description = `Escalation from customer ...${customerDisplay}`;
      } else if (conv.status === "active") {
        description = `New message from ...${customerDisplay}`;
      } else if (conv.status === "closed") {
        description = `Conversation with ...${customerDisplay} closed`;
      } else {
        description = `Conversation from ...${customerDisplay}`;
      }

      activities.push({
        type: "conversation",
        description,
        timestamp: conv.updatedAt ?? conv.lastCustomerMessageAt,
        link: `/conversations?selected=${conv._id}`,
      });
    }

    for (const order of recentOrders) {
      const orderNum = order.orderNumber;
      let description: string;

      switch (order.status) {
        case "draft":
          description = `Order ${orderNum} started`;
          break;
        case "confirmed":
          description = `Order ${orderNum} confirmed`;
          break;
        case "paid":
          description = `Order ${orderNum} paid`;
          break;
        case "preparing":
          description = `Order ${orderNum} being prepared`;
          break;
        case "ready":
          description = `Order ${orderNum} ready for pickup`;
          break;
        case "delivered":
          description = `Order ${orderNum} delivered`;
          break;
        case "cancelled":
          description = `Order ${orderNum} cancelled`;
          break;
        default:
          description = `Order ${orderNum} updated`;
      }

      activities.push({
        type: "order",
        description,
        timestamp: order.updatedAt ?? order.createdAt,
        link: `/orders/${order._id}`,
      });
    }

    activities.sort((a, b) => b.timestamp - a.timestamp);

    return activities.slice(0, limit);
  },
});
