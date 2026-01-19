import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { TwilioWhatsAppProvider } from "./twilio";
import type { Doc, Id } from "../../_generated/dataModel";

type ConversationData = {
  conversation: Doc<"conversations">;
  business: Doc<"businesses">;
  whatsappConnection: Doc<"whatsappConnections">;
  customerPhone: string;
} | null;

type SendMessageResult = {
  success: true;
  messageId: string | undefined;
};

export const loadConversationData = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<ConversationData> => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const business = await ctx.db.get(conversation.businessId);
    if (!business) {
      return null;
    }

    const whatsappConnection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_business", (q) => q.eq("businessId", conversation.businessId))
      .first();

    if (!whatsappConnection) {
      return null;
    }

    return {
      conversation,
      business,
      whatsappConnection,
      customerPhone: conversation.customerId,
    };
  },
});

export const storeOutgoingMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    externalId: v.optional(v.string()),
    deliveryStatus: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"messages">> => {
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      sender: "business",
      content: args.content,
      externalId: args.externalId,
      deliveryStatus: args.deliveryStatus,
      createdAt: Date.now(),
    });

    return messageId;
  },
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const sendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    type: v.literal("text"),
  },
  handler: async (ctx, args): Promise<SendMessageResult> => {
    const { conversationId, content } = args;

    const data: ConversationData = await ctx.runQuery(
      internal.integrations.whatsapp.actions.loadConversationData,
      { conversationId }
    );

    if (!data) {
      throw new Error("Conversation not found or WhatsApp not configured");
    }

    const { whatsappConnection, customerPhone } = data;

    const provider = new TwilioWhatsAppProvider(
      whatsappConnection.credentials,
      whatsappConnection.phoneNumber
    );

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await provider.sendText(customerPhone, content);

      if (result.success) {
        await ctx.runMutation(
          internal.integrations.whatsapp.actions.storeOutgoingMessage,
          {
            conversationId,
            content,
            externalId: result.messageId,
            deliveryStatus: "sent",
          }
        );

        return {
          success: true,
          messageId: result.messageId,
        };
      }

      const isRateLimitError = result.error?.includes("429") || 
                               result.error?.includes("rate limit") ||
                               result.error?.includes("Too Many Requests");

      if (!isRateLimitError) {
        lastError = new Error(result.error || "Failed to send message");
        break;
      }

      // Exponential backoff formula: 2^attempt * 1000ms (1s, 2s, 4s)
      const backoffMs = Math.pow(2, attempt) * 1000;
      await sleep(backoffMs);
      lastError = new Error(result.error || "Rate limited");
    }

    await ctx.runMutation(
      internal.integrations.whatsapp.actions.storeOutgoingMessage,
      {
        conversationId,
        content,
        deliveryStatus: "failed",
      }
    );

    throw lastError || new Error("Failed to send message after retries");
  },
});
