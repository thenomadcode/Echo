import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";


export const processIncomingMessage = internalMutation({
  args: {
    businessId: v.id("businesses"),
    customerPhone: v.string(),
    content: v.string(),
    messageType: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("voice"),
      v.literal("document")
    ),
    externalId: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const {
      businessId,
      customerPhone,
      content,
      externalId,
      mediaUrl,
      mediaType,
      timestamp,
    } = args;

    // channelId format: whatsapp:{customerPhone}:{businessId} - unique per customer-business pair
    const channelId = `whatsapp:${customerPhone}:${businessId}`;

    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_channel", (q) =>
        q.eq("channelId", channelId).eq("businessId", businessId)
      )
      .first();

    let conversationId: Id<"conversations">;
    const now = Date.now();

    const customerRecordId = await ctx.runMutation(
      internal.customers.getOrCreate,
      { businessId, phone: customerPhone }
    );

    if (existingConversation) {
      conversationId = existingConversation._id;
      await ctx.db.patch(conversationId, {
        lastCustomerMessageAt: timestamp,
        customerRecordId,
        updatedAt: now,
      });
    } else {
      conversationId = await ctx.db.insert("conversations", {
        businessId,
        customerId: customerPhone,
        customerRecordId,
        channel: "whatsapp",
        channelId,
        lastCustomerMessageAt: timestamp,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      sender: "customer",
      content,
      externalId,
      deliveryStatus: "received",
      mediaUrl,
      mediaType,
      createdAt: timestamp,
    });

    return {
      conversationId,
      messageId,
      isNewConversation: !existingConversation,
    };
  },
});

export const getBusinessByPhoneNumber = internalMutation({
  args: {
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (!connection) {
      return null;
    }

    const business = await ctx.db.get(connection.businessId);

    if (!business) {
      return null;
    }

    return {
      businessId: business._id,
      credentials: connection.credentials,
      provider: connection.provider,
    };
  },
});

export const updateMessageStatus = internalMutation({
  args: {
    externalId: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed"),
      v.literal("undelivered")
    ),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { externalId, status, errorCode, errorMessage } = args;

    const message = await ctx.db
      .query("messages")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .first();

    if (!message) {
      console.log(`Message not found for externalId: ${externalId}`);
      return { updated: false, reason: "message_not_found" };
    }

    const updateData: Record<string, unknown> = {
      deliveryStatus: status,
    };

    if (status === "failed" || status === "undelivered") {
      if (errorCode) updateData.errorCode = errorCode;
      if (errorMessage) updateData.errorMessage = errorMessage;

      console.error(
        `Message delivery failed - externalId: ${externalId}, ` +
        `status: ${status}, errorCode: ${errorCode || "N/A"}, ` +
        `errorMessage: ${errorMessage || "N/A"}`
      );
    }

    await ctx.db.patch(message._id, updateData);

    return { updated: true, messageId: message._id };
  },
});
