import { v } from "convex/values";
import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
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

export const getConversationForPipeline = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const paidOrders = orders.filter(
      (o) => o.status !== "draft" && o.status !== "cancelled"
    );

    return {
      conversationId: args.conversationId,
      customerId: conversation.customerRecordId,
      orders: paidOrders,
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

interface MemoryFact {
  category: "allergy" | "restriction" | "preference" | "behavior" | "complaint";
  fact: string;
  confidence: number;
}

const MEMORY_EXTRACTION_SYSTEM_PROMPT = `You are analyzing a WhatsApp customer service conversation to extract memorable facts about the customer.

Your task: Extract facts that would be useful to remember for future interactions with this customer.

Categories to extract:
1. **allergy**: Food allergies or intolerances (e.g., "allergic to peanuts", "lactose intolerant", "can't eat shellfish")
   - These are SAFETY CRITICAL - be very confident when extracting
   - Confidence: 0.95-1.0 for explicit mentions, 0.85-0.94 for implied
   
2. **restriction**: Dietary restrictions (e.g., "vegetarian", "halal", "no pork", "keto diet")
   - Confidence: 0.85-0.95 for explicit, 0.75-0.84 for implied

3. **preference**: Food or service preferences (e.g., "likes extra spicy", "prefers delivery", "always orders same thing")
   - Confidence: 0.80-0.90 for explicit, 0.65-0.79 for implied

4. **behavior**: Ordering patterns or behaviors (e.g., "usually orders on weekends", "tips well", "frequent customer")
   - Confidence: 0.70-0.85

5. **complaint**: Past complaints or issues (e.g., "had delivery problem before", "complained about cold food")
   - Confidence: 0.80-0.95

Rules:
- Only extract facts explicitly stated or strongly implied in the conversation
- Do not infer facts that are not supported by the messages
- Keep facts concise (under 100 characters each)
- Avoid duplicates - each fact should be unique
- Confidence scores: 0.0-1.0 where 1.0 is absolutely certain
- If no facts found for a category, that's fine - don't make things up

Respond in JSON format:
{
  "facts": [
    {"category": "allergy", "fact": "allergic to peanuts", "confidence": 0.98},
    {"category": "preference", "fact": "likes food extra spicy", "confidence": 0.85}
  ]
}

Return an empty array if no relevant facts are found:
{"facts": []}`;

export const extractMemoryFacts = internalAction({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<MemoryFact[]> => {
    const conversationData = await ctx.runQuery(
      internal.ai.summary.getConversationMessages,
      { conversationId: args.conversationId }
    );

    if (!conversationData) {
      throw new Error("Conversation not found");
    }

    const { messages, businessName } = conversationData;

    if (messages.length < 2) {
      return [];
    }

    const formattedMessages = formatMessagesForPrompt(messages, businessName);

    try {
      const provider = createOpenAIProvider();

      const result = await provider.complete({
        messages: [{ role: "user", content: `Extract customer facts from this conversation:\n\n${formattedMessages}` }],
        systemPrompt: MEMORY_EXTRACTION_SYSTEM_PROMPT,
        maxTokens: 512,
        responseFormat: "json",
      });

      const parsed = JSON.parse(result.content) as {
        facts?: Array<{
          category?: string;
          fact?: string;
          confidence?: number;
        }>;
      };

      if (!Array.isArray(parsed.facts)) {
        return [];
      }

      const validCategories = ["allergy", "restriction", "preference", "behavior", "complaint"];
      const validatedFacts: MemoryFact[] = [];
      
      for (const item of parsed.facts) {
        if (!item.category || !validCategories.includes(item.category)) {
          continue;
        }

        if (!item.fact || typeof item.fact !== "string" || item.fact.trim().length === 0) {
          continue;
        }

        let confidence = typeof item.confidence === "number" ? item.confidence : 0.8;
        confidence = Math.max(0, Math.min(1, confidence));

        if (item.category === "allergy" && confidence < 0.85) {
          confidence = 0.85;
        }

        validatedFacts.push({
          category: item.category as MemoryFact["category"],
          fact: item.fact.trim().slice(0, 200),
          confidence,
        });
      }

      return validatedFacts;
    } catch (error) {
      console.error("Failed to extract memory facts:", error);
      return [];
    }
  },
});

export const generateConversationSummary = internalAction({
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

interface ContradictionPair {
  existing: string;
  new: string;
  category: string;
}

function detectContradictions(
  existingFacts: Array<{ category: string; fact: string }>,
  newFacts: Array<{ category: string; fact: string; confidence: number }>
): ContradictionPair[] {
  const contradictions: ContradictionPair[] = [];

  const oppositePatterns: Array<{
    pattern: RegExp;
    opposite: RegExp;
    category: string;
  }> = [
    { pattern: /\blikes?\s+spicy\b/i, opposite: /\bno\s+spicy\b|\bdoesn'?t\s+like\s+spicy\b|\bavoid\s+spicy\b/i, category: "preference" },
    { pattern: /\bno\s+spicy\b|\bdoesn'?t\s+like\s+spicy\b/i, opposite: /\blikes?\s+spicy\b|\bextra\s+spicy\b/i, category: "preference" },
    { pattern: /\bvegetarian\b/i, opposite: /\beats?\s+meat\b|\blikes?\s+meat\b/i, category: "restriction" },
    { pattern: /\bvegan\b/i, opposite: /\beats?\s+(meat|dairy|cheese)\b|\blikes?\s+(meat|cheese)\b/i, category: "restriction" },
    { pattern: /\bno\s+dairy\b|\blactose\s+intolerant\b/i, opposite: /\blikes?\s+(cheese|milk|dairy)\b/i, category: "allergy" },
    { pattern: /\bno\s+gluten\b|\bgluten[\s-]?free\b/i, opposite: /\blikes?\s+(bread|pasta)\b/i, category: "restriction" },
  ];

  for (const newFact of newFacts) {
    for (const existingFact of existingFacts) {
      if (existingFact.category !== newFact.category) continue;

      for (const { pattern, opposite, category } of oppositePatterns) {
        if (category !== newFact.category) continue;

        const existingMatchesPattern = pattern.test(existingFact.fact);
        const newMatchesOpposite = opposite.test(newFact.fact);

        const existingMatchesOpposite = opposite.test(existingFact.fact);
        const newMatchesPattern = pattern.test(newFact.fact);

        if (
          (existingMatchesPattern && newMatchesOpposite) ||
          (existingMatchesOpposite && newMatchesPattern)
        ) {
          contradictions.push({
            existing: existingFact.fact,
            new: newFact.fact,
            category: newFact.category,
          });
        }
      }
    }
  }

  return contradictions;
}

function normalizeFactForComparison(fact: string): string {
  return fact
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicateFact(
  existingFacts: Array<{ fact: string; category: string }>,
  newFact: { fact: string; category: string }
): boolean {
  const normalizedNew = normalizeFactForComparison(newFact.fact);

  for (const existing of existingFacts) {
    if (existing.category !== newFact.category) continue;

    const normalizedExisting = normalizeFactForComparison(existing.fact);

    if (normalizedNew === normalizedExisting) return true;

    if (
      normalizedNew.includes(normalizedExisting) ||
      normalizedExisting.includes(normalizedNew)
    ) {
      return true;
    }
  }

  return false;
}

interface PipelineResult {
  success: boolean;
  reason?: string;
  error?: string;
  summary?: {
    sentiment: "positive" | "neutral" | "negative";
    keyEventsCount: number;
  };
  memory?: {
    extracted: number;
    added: number;
    skippedDuplicates: number;
    skippedContradictions: number;
    contradictions: number;
  };
  orders?: {
    processed: number;
  };
}

export const processConversationMemory = internalAction({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<PipelineResult> => {
    try {
      const pipelineData = await ctx.runQuery(
        internal.ai.summary.getConversationForPipeline,
        { conversationId: args.conversationId }
      );

      if (!pipelineData || !pipelineData.customerId) {
        console.log(
          `Memory pipeline: No customer linked to conversation ${args.conversationId}`
        );
        return { success: false, reason: "no_customer" };
      }

      const customerId: Id<"customers"> = pipelineData.customerId;
      const orderIds: Id<"orders">[] = pipelineData.orders.map((o: { _id: Id<"orders"> }) => o._id);

      const summaryResult: SummaryResult = await ctx.runAction(
        internal.ai.summary.generateConversationSummary,
        { conversationId: args.conversationId }
      );

      await ctx.runMutation(internal.conversationSummaries.createInternal, {
        conversationId: args.conversationId,
        customerId,
        summary: summaryResult.summary,
        sentiment: summaryResult.sentiment,
        keyEvents: summaryResult.keyEvents,
        orderIds: orderIds.length > 0 ? orderIds : undefined,
      });

      const extractedFacts = await ctx.runAction(
        internal.ai.summary.extractMemoryFacts,
        { conversationId: args.conversationId }
      );

      const existingMemories = await ctx.runQuery(
        internal.customerMemory.listByCustomerInternal,
        { customerId }
      );

      const existingFacts = existingMemories.map((m) => ({
        fact: m.fact,
        category: m.category,
      }));

      const highConfidenceFacts = extractedFacts.filter((f) => f.confidence > 0.8);

      const contradictions = detectContradictions(existingFacts, highConfidenceFacts);

      if (contradictions.length > 0) {
        console.log(
          `Memory pipeline: Detected ${contradictions.length} contradiction(s) for customer ${customerId}:`,
          contradictions.map((c) => `"${c.existing}" vs "${c.new}" (${c.category})`).join(", ")
        );
      }

      const contradictedFacts = new Set(contradictions.map((c) => c.new));

      let addedCount = 0;
      let skippedDuplicates = 0;
      let skippedContradictions = 0;

      for (const fact of highConfidenceFacts) {
        if (contradictedFacts.has(fact.fact)) {
          skippedContradictions++;
          continue;
        }

        if (isDuplicateFact(existingFacts, fact)) {
          skippedDuplicates++;
          continue;
        }

        await ctx.runMutation(internal.customerMemory.addInternal, {
          customerId,
          category: fact.category,
          fact: fact.fact,
          source: "ai_extracted",
          confidence: fact.confidence,
          extractedFrom: args.conversationId,
        });

        existingFacts.push({ fact: fact.fact, category: fact.category });
        addedCount++;
      }

      if (pipelineData.orders.length > 0) {
        for (const order of pipelineData.orders) {
          await ctx.runMutation(internal.customers.updateStatsInternal, {
            customerId,
            orderTotal: order.total,
          });
        }
      }

      return {
        success: true,
        summary: {
          sentiment: summaryResult.sentiment,
          keyEventsCount: summaryResult.keyEvents.length,
        },
        memory: {
          extracted: extractedFacts.length,
          added: addedCount,
          skippedDuplicates,
          skippedContradictions,
          contradictions: contradictions.length,
        },
        orders: {
          processed: pipelineData.orders.length,
        },
      };
    } catch (error) {
      console.error("Memory pipeline failed:", error);
      return {
        success: false,
        reason: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
