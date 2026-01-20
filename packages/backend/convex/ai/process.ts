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

const pendingOrderItemValidator = v.object({
  productQuery: v.string(),
  quantity: v.number(),
  productId: v.optional(v.id("products")),
  price: v.optional(v.number()),
});

const pendingOrderValidator = v.object({
  items: v.array(pendingOrderItemValidator),
  total: v.optional(v.number()),
});

export const updateConversation = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    detectedLanguage: v.optional(v.string()),
    state: v.optional(v.string()),
    pendingOrder: v.optional(pendingOrderValidator),
    escalationReason: v.optional(v.string()),
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
    if (args.pendingOrder !== undefined) {
      updates.pendingOrder = args.pendingOrder;
    }
    if (args.escalationReason !== undefined) {
      updates.escalationReason = args.escalationReason;
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

export const notifyEscalation = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    businessId: v.id("businesses"),
    reason: v.string(),
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      state: "escalated",
      escalationReason: args.reason,
      updatedAt: Date.now(),
    });

    console.log(
      `[ESCALATION] Business ${args.businessId}: Conversation ${args.conversationId} escalated. ` +
        `Customer: ${args.customerId}. Reason: ${args.reason}`
    );
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

    if (conversation.state === "escalated") {
      return {
        response: getEscalatedConversationResponse(conversation.detectedLanguage ?? "en"),
        intent: { type: "unknown" },
        shouldEscalate: true,
        detectedLanguage: conversation.detectedLanguage ?? "en",
      };
    }

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

    let newState = determineNewState(intent, conversation.state ?? "idle");

    const orderUpdate = handleOrderIntent(intent, conversation.pendingOrder, products);

    if (shouldEscalate) {
      newState = "escalated";
      await ctx.runMutation(internal.ai.process.notifyEscalation, {
        conversationId: args.conversationId,
        businessId: conversation.businessId,
        reason: escalationResult.reason || "Customer requested human assistance",
        customerId: conversation.customerId,
      });
    } else if (newState !== conversation.state || orderUpdate.pendingOrder !== undefined) {
      await ctx.runMutation(internal.ai.process.updateConversation, {
        conversationId: args.conversationId,
        state: newState,
        pendingOrder: orderUpdate.pendingOrder,
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
    case "order_modify":
      return currentState === "idle" ? "ordering" : currentState;
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

interface PendingOrderItem {
  productQuery: string;
  quantity: number;
  productId?: Id<"products">;
  price?: number;
}

interface PendingOrder {
  items: PendingOrderItem[];
  total?: number;
}

interface OrderUpdateResult {
  pendingOrder?: PendingOrder;
  message?: string;
}

function handleOrderIntent(
  intent: Intent,
  currentOrder: PendingOrder | undefined,
  products: Doc<"products">[]
): OrderUpdateResult {
  if (intent.type === "order_start") {
    const newItems = intent.items.map((item) => {
      const matchedProduct = findMatchingProduct(item.productQuery, products);
      return {
        productQuery: item.productQuery,
        quantity: item.quantity,
        productId: matchedProduct?._id,
        price: matchedProduct?.price,
      };
    });

    const total = calculateOrderTotal(newItems);

    return {
      pendingOrder: {
        items: newItems,
        total,
      },
    };
  }

  if (intent.type === "order_modify") {
    const items = currentOrder?.items ?? [];

    if (intent.action === "add") {
      const matchedProduct = findMatchingProduct(intent.item, products);
      const existingIndex = items.findIndex(
        (i) => i.productQuery.toLowerCase() === intent.item.toLowerCase()
      );

      let newItems: PendingOrderItem[];
      if (existingIndex >= 0) {
        newItems = items.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        newItems = [
          ...items,
          {
            productQuery: intent.item,
            quantity: 1,
            productId: matchedProduct?._id,
            price: matchedProduct?.price,
          },
        ];
      }

      return {
        pendingOrder: {
          items: newItems,
          total: calculateOrderTotal(newItems),
        },
      };
    }

    if (intent.action === "remove") {
      const existingIndex = items.findIndex(
        (i) => i.productQuery.toLowerCase().includes(intent.item.toLowerCase())
      );

      if (existingIndex === -1) {
        return { message: `"${intent.item}" is not in your order.` };
      }

      const newItems = items.filter((_, idx) => idx !== existingIndex);
      return {
        pendingOrder: {
          items: newItems,
          total: calculateOrderTotal(newItems),
        },
      };
    }

    if (intent.action === "change_quantity") {
      return { pendingOrder: currentOrder };
    }
  }

  return {};
}

function findMatchingProduct(
  query: string,
  products: Doc<"products">[]
): Doc<"products"> | undefined {
  const normalizedQuery = query.toLowerCase();

  const exactMatch = products.find(
    (p) => p.available && p.name.toLowerCase() === normalizedQuery
  );
  if (exactMatch) return exactMatch;

  const partialMatch = products.find(
    (p) => p.available && p.name.toLowerCase().includes(normalizedQuery)
  );
  if (partialMatch) return partialMatch;

  const reverseMatch = products.find(
    (p) => p.available && normalizedQuery.includes(p.name.toLowerCase())
  );
  return reverseMatch;
}

function calculateOrderTotal(items: PendingOrderItem[]): number {
  return items.reduce((sum, item) => {
    const price = item.price ?? 0;
    return sum + price * item.quantity;
  }, 0);
}

function getEscalatedConversationResponse(language: string): string {
  const responses: Record<string, string> = {
    en: "This conversation has been escalated to a human agent. A team member will respond shortly. Thank you for your patience.",
    es: "Esta conversación ha sido escalada a un agente humano. Un miembro del equipo responderá pronto. Gracias por su paciencia.",
    pt: "Esta conversa foi escalada para um agente humano. Um membro da equipe responderá em breve. Obrigado pela paciência.",
  };
  return responses[language] ?? responses["en"] ?? "";
}
