import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { detectEscalation } from "./escalation";
import { serializeIntent, type AIResponse, type Intent, type Message } from "./types";

type ProcessMessageResult = {
  response: string;
  intent: Intent;
  shouldEscalate: boolean;
  detectedLanguage: string;
};

interface ConversationContext {
  conversation: Doc<"conversations">;
  business: Doc<"businesses">;
  products: Doc<"products">[];
  messages: Doc<"messages">[];
}

export const loadContext = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<ConversationContext | null> => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const business = await ctx.db.get(conversation.businessId);
    if (!business) {
      return null;
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_business", (q) =>
        q.eq("businessId", conversation.businessId as unknown as string).eq("deleted", false)
      )
      .collect();

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(20);

    return {
      conversation,
      business,
      products,
      messages: messages.reverse(),
    };
  },
});

export const updateConversation = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    detectedLanguage: v.optional(v.string()),
    state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.detectedLanguage !== undefined) {
      updates.detectedLanguage = args.detectedLanguage;
    }
    if (args.state !== undefined) {
      updates.state = args.state;
    }

    await ctx.db.patch(args.conversationId, updates);
  },
});

export const logAIInteraction = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    intent: v.object({
      type: v.string(),
      query: v.optional(v.string()),
      items: v.optional(
        v.array(
          v.object({
            productQuery: v.string(),
            quantity: v.number(),
          })
        )
      ),
      action: v.optional(v.string()),
      item: v.optional(v.string()),
      topic: v.optional(v.string()),
    }),
    prompt: v.string(),
    response: v.string(),
    model: v.string(),
    tokensUsed: v.number(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiLogs", {
      conversationId: args.conversationId,
      messageId: args.messageId,
      intent: args.intent,
      prompt: args.prompt,
      response: args.response,
      model: args.model,
      tokensUsed: args.tokensUsed,
      latencyMs: args.latencyMs,
      createdAt: Date.now(),
    });
  },
});

export const storeMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    sender: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"messages">> => {
    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.content,
      sender: args.sender,
      createdAt: Date.now(),
    });
  },
});

export const processMessage = action({
  args: {
    conversationId: v.id("conversations"),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<ProcessMessageResult> => {
    const startTime = Date.now();

    const context = await ctx.runQuery(internal.ai.process.loadContext, {
      conversationId: args.conversationId,
    });

    if (!context) {
      throw new Error("Conversation or business not found");
    }

    const { conversation, business, products, messages } = context;

    let detectedLanguage = conversation.detectedLanguage ?? "en";
    const isFirstMessage = messages.length === 0;

    if (isFirstMessage || !conversation.detectedLanguage) {
      const languageResult = await ctx.runAction(api.ai.language.detectLanguage, {
        message: args.message,
      });
      detectedLanguage = languageResult;

      await ctx.runMutation(internal.ai.process.updateConversation, {
        conversationId: args.conversationId,
        detectedLanguage,
      });
    }

    const productNames = products
      .filter((p) => p.available)
      .map((p) => p.name);

    const conversationHistory: Message[] = messages.map((msg) => ({
      role: msg.sender === "customer" ? "user" : "assistant",
      content: msg.content,
    }));

    const intent = await ctx.runAction(api.ai.intent.classifyIntent, {
      message: args.message,
      conversationHistory,
      productNames,
    });

    const failureCount = 0;
    const escalationResult = detectEscalation(args.message, conversationHistory, failureCount);

    const shouldEscalate = escalationResult.shouldEscalate || intent.type === "escalation_request";

    const businessContext = {
      name: business.name,
      type: business.type,
      address: business.address,
      businessHours: business.businessHours,
      aiGreeting: business.aiGreeting,
      aiTone: undefined as string | undefined,
    };

    const productContext = products.map((p) => ({
      name: p.name,
      price: p.price,
      currency: p.currency,
      description: p.description,
      available: p.available,
    }));

    const response = await ctx.runAction(api.ai.response.generateResponse, {
      intent: serializeIntent(intent),
      conversationHistory,
      businessContext,
      products: productContext,
      language: detectedLanguage,
      conversationState: conversation.state ?? "idle",
    });

    const newState = determineNewState(intent, conversation.state ?? "idle");

    if (newState !== conversation.state) {
      await ctx.runMutation(internal.ai.process.updateConversation, {
        conversationId: args.conversationId,
        state: newState,
      });
    }

    const messageId = await ctx.runMutation(internal.ai.process.storeMessage, {
      conversationId: args.conversationId,
      content: response,
      sender: "business",
    });

    const latencyMs = Date.now() - startTime;

    await ctx.runMutation(internal.ai.process.logAIInteraction, {
      conversationId: args.conversationId,
      messageId,
      intent: serializeIntent(intent),
      prompt: `Message: ${args.message}`,
      response,
      model: "gpt-4o-mini",
      tokensUsed: 0,
      latencyMs,
    });

    return {
      response,
      intent,
      shouldEscalate,
      detectedLanguage,
    } satisfies AIResponse;
  },
});

function determineNewState(
  intent: Intent,
  currentState: string
): string {
  switch (intent.type) {
    case "order_start":
      return "ordering";
    case "product_question":
      if (currentState === "idle") {
        return "browsing";
      }
      return currentState;
    case "escalation_request":
      return "escalated";
    default:
      return currentState;
  }
}
