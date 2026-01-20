import { v } from "convex/values";
import { action } from "../_generated/server";
import { createOpenAIProvider } from "./providers/openai";
import type { Intent, Message, OrderItem } from "./types";

const INTENT_CLASSIFICATION_PROMPT = `You are an intent classifier for a customer service chatbot. Analyze the customer's message and classify their intent.

Available products: {{PRODUCTS}}

IMPORTANT RULES:
1. For product-related queries, match against available products even with misspellings
2. Default quantity is 1 if not specified
3. For business questions, identify the topic: "hours", "location", "delivery", or "payment"
4. If the intent is unclear, classify as "unknown"

Respond with a JSON object in one of these formats:

For greeting (hi, hello, hey):
{"type": "greeting"}

For product question (do you have X, how much is X, what is X):
{"type": "product_question", "query": "<product name or search term>"}

For starting an order (I want X, order X, give me X):
{"type": "order_start", "items": [{"productQuery": "<product>", "quantity": <number>}]}

For modifying an order (add X, remove X, change to X):
{"type": "order_modify", "action": "<add|remove|change_quantity>", "item": "<product name>"}

For business question (when open, where located, do you deliver):
{"type": "business_question", "topic": "<hours|location|delivery|payment>"}

For escalation request (talk to human, speak to person, need help):
{"type": "escalation_request"}

For small talk (how are you, nice weather):
{"type": "small_talk"}

For unclear intent:
{"type": "unknown"}

Analyze the message considering conversation context when provided.`;

interface IntentResult {
  type: string;
  query?: string;
  items?: Array<{ productQuery: string; quantity: number }>;
  action?: string;
  item?: string;
  topic?: string;
}

const messageValidator = v.object({
  role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
  content: v.string(),
});

export const classifyIntent = action({
  args: {
    message: v.string(),
    conversationHistory: v.array(messageValidator),
    productNames: v.array(v.string()),
  },
  handler: async (_ctx, args): Promise<Intent> => {
    const { message, conversationHistory, productNames } = args;

    if (!message || message.trim().length === 0) {
      return { type: "unknown" };
    }

    const productList =
      productNames.length > 0
        ? productNames.join(", ")
        : "No products available";

    const systemPrompt = INTENT_CLASSIFICATION_PROMPT.replace(
      "{{PRODUCTS}}",
      productList
    );

    const contextMessages: Message[] = conversationHistory.slice(-5).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    contextMessages.push({ role: "user", content: message });

    try {
      const provider = createOpenAIProvider();

      const result = await provider.complete({
        messages: contextMessages,
        systemPrompt,
        temperature: 0,
        maxTokens: 150,
        responseFormat: "json",
      });

      const parsed = JSON.parse(result.content) as IntentResult;
      return mapToIntent(parsed);
    } catch (error) {
      console.error(
        "Intent classification failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return { type: "unknown" };
    }
  },
});

function mapToIntent(result: IntentResult): Intent {
  switch (result.type) {
    case "greeting":
      return { type: "greeting" };

    case "product_question":
      return {
        type: "product_question",
        query: result.query ?? "",
      };

    case "order_start": {
      const items: OrderItem[] = (result.items ?? []).map((item) => ({
        productQuery: item.productQuery || "",
        quantity: typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1,
      }));
      return { type: "order_start", items };
    }

    case "order_modify":
      return {
        type: "order_modify",
        action: validateOrderAction(result.action),
        item: result.item ?? "",
      };

    case "business_question":
      return {
        type: "business_question",
        topic: result.topic ?? "hours",
      };

    case "escalation_request":
      return { type: "escalation_request" };

    case "small_talk":
      return { type: "small_talk" };

    default:
      return { type: "unknown" };
  }
}

function validateOrderAction(action: string | undefined): "add" | "remove" | "change_quantity" {
  if (action === "add" || action === "remove" || action === "change_quantity") {
    return action;
  }
  return "add";
}
