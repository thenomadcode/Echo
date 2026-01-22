import { v } from "convex/values";
import { action, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { createOpenAIProvider } from "./providers/openai";

export const getConversationMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    messages.sort((a, b) => a.createdAt - b.createdAt);

    const business = await ctx.db.get(conversation.businessId);

    let customer: Doc<"customers"> | null = null;
    if (conversation.customerRecordId) {
      customer = await ctx.db.get(conversation.customerRecordId);
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    return {
      conversation,
      messages,
      businessName: business?.name ?? "Business",
      customer,
      orders,
    };
  },
});

interface SummaryResult {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  keyEvents: string[];
}

const SUMMARY_SYSTEM_PROMPT = `You are analyzing a WhatsApp customer service conversation. Generate a concise summary.

Your task:
1. Write a 100-200 word summary capturing:
   - What the customer wanted or ordered
   - Any issues or complaints raised
   - Any preferences or special requests mentioned
   - How the conversation ended (resolved, escalated, pending)

2. Classify the overall sentiment:
   - "positive": Customer was happy, issue resolved, good experience
   - "neutral": Standard transaction, no strong emotions either way
   - "negative": Customer complained, issue unresolved, frustration expressed

3. Extract key events from the conversation. Include any of these that occurred:
   - "complaint": Customer expressed dissatisfaction
   - "compliment": Customer praised the service
   - "refund_request": Customer asked for refund
   - "order_placed": Customer completed an order
   - "order_cancelled": Customer cancelled an order
   - "escalation": Conversation was escalated to human
   - "allergy_mentioned": Customer mentioned food allergy
   - "delivery_issue": Problem with delivery
   - "product_unavailable": Requested product was not available
   - "price_inquiry": Customer asked about prices
   - "repeat_customer": Customer mentioned previous orders

Respond in JSON format:
{
  "summary": "string (100-200 words)",
  "sentiment": "positive" | "neutral" | "negative",
  "keyEvents": ["string", ...]
}`;

function formatMessagesForPrompt(
  messages: Doc<"messages">[],
  businessName: string
): string {
  if (messages.length === 0) {
    return "No messages in conversation.";
  }

  return messages
    .map((msg) => {
      const sender = msg.sender === "customer" ? "Customer" : businessName;
      return `${sender}: ${msg.content}`;
    })
    .join("\n");
}

export const generateConversationSummary = action({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<SummaryResult> => {
    const conversationData = await ctx.runQuery(
      internal.ai.summary.getConversationMessages,
      { conversationId: args.conversationId }
    );

    if (!conversationData) {
      throw new Error("Conversation not found");
    }

    const { conversation, messages, businessName, customer, orders } = conversationData;

    const contextParts: string[] = [];
    
    if (customer?.name) {
      contextParts.push(`Customer name: ${customer.name}`);
    }
    if (customer?.tier && customer.tier !== "regular") {
      contextParts.push(`Customer tier: ${customer.tier}`);
    }
    if (orders.length > 0) {
      const orderInfo = orders.map((order) => 
        `Order #${order.orderNumber} (${order.status}): ${order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}`
      ).join("; ");
      contextParts.push(`Orders: ${orderInfo}`);
    }
    if (conversation.state === "escalated") {
      contextParts.push(`Conversation was escalated to human agent`);
      if (conversation.escalationReason) {
        contextParts.push(`Escalation reason: ${conversation.escalationReason}`);
      }
    }

    const formattedMessages = formatMessagesForPrompt(messages, businessName);

    const userPrompt = contextParts.length > 0
      ? `Context:\n${contextParts.join("\n")}\n\nConversation:\n${formattedMessages}`
      : `Conversation:\n${formattedMessages}`;

    if (messages.length < 2) {
      return {
        summary: "Brief conversation with minimal exchange.",
        sentiment: "neutral",
        keyEvents: [],
      };
    }

    try {
      const provider = createOpenAIProvider();

      const result = await provider.complete({
        messages: [{ role: "user", content: userPrompt }],
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        maxTokens: 512,
        responseFormat: "json",
      });

      const parsed = JSON.parse(result.content) as {
        summary?: string;
        sentiment?: string;
        keyEvents?: string[];
      };

      const summary = typeof parsed.summary === "string" 
        ? parsed.summary 
        : "Unable to generate summary.";

      const validSentiments = ["positive", "neutral", "negative"];
      const sentiment = validSentiments.includes(parsed.sentiment ?? "")
        ? (parsed.sentiment as "positive" | "neutral" | "negative")
        : "neutral";

      const keyEvents = Array.isArray(parsed.keyEvents)
        ? parsed.keyEvents.filter((e): e is string => typeof e === "string")
        : [];

      return {
        summary,
        sentiment,
        keyEvents,
      };
    } catch (error) {
      console.error("Failed to generate conversation summary:", error);
      
      const fallbackParts: string[] = [];
      
      if (orders.length > 0) {
        fallbackParts.push(`Customer placed ${orders.length} order(s).`);
      }
      if (conversation.state === "escalated") {
        fallbackParts.push("Conversation was escalated to human support.");
      }
      if (messages.length > 0) {
        fallbackParts.push(`Conversation contained ${messages.length} messages.`);
      }

      return {
        summary: fallbackParts.length > 0 
          ? fallbackParts.join(" ")
          : "Conversation summary generation failed.",
        sentiment: conversation.state === "escalated" ? "negative" : "neutral",
        keyEvents: conversation.state === "escalated" ? ["escalation"] : [],
      };
    }
  },
});
