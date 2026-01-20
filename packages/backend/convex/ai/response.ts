import { v } from "convex/values";
import { action } from "../_generated/server";
import { createOpenAIProvider } from "./providers/openai";
import {
  buildSystemPrompt,
  type BusinessInfo,
  type Product,
  type ConversationState,
  type LanguageCode,
} from "./prompts";
import type { Intent, Message } from "./types";

const intentValidator = v.object({
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
});

const messageValidator = v.object({
  role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
  content: v.string(),
});

const businessContextValidator = v.object({
  name: v.string(),
  type: v.string(),
  address: v.optional(v.string()),
  businessHours: v.optional(
    v.object({
      open: v.string(),
      close: v.string(),
      days: v.array(v.number()),
    })
  ),
  aiGreeting: v.optional(v.string()),
  aiTone: v.optional(v.string()),
});

const productValidator = v.object({
  name: v.string(),
  price: v.number(),
  currency: v.string(),
  description: v.optional(v.string()),
  available: v.boolean(),
});

interface ResponseGenerationResult {
  response: string;
  tokensUsed: number;
}

export const generateResponse = action({
  args: {
    intent: intentValidator,
    conversationHistory: v.array(messageValidator),
    businessContext: businessContextValidator,
    products: v.array(productValidator),
    language: v.string(),
    conversationState: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<ResponseGenerationResult> => {
    const {
      intent,
      conversationHistory,
      businessContext,
      products,
      language,
      conversationState,
    } = args;

    const typedIntent = intent as unknown as Intent;
    const typedLanguage = validateLanguage(language);
    const typedState = validateConversationState(conversationState);
    const typedBusiness = businessContext as BusinessInfo;
    const typedProducts = products as Product[];

    const systemPrompt = buildSystemPrompt({
      business: typedBusiness,
      products: typedProducts,
      conversationState: typedState,
      detectedLanguage: typedLanguage,
    });

    const contextInstruction = buildContextInstruction(typedIntent, typedProducts);

    const messages: Message[] = conversationHistory.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const fullSystemPrompt = contextInstruction
      ? `${systemPrompt}\n\n## Current Task\n${contextInstruction}`
      : systemPrompt;

    try {
      const provider = createOpenAIProvider();

      const result = await provider.complete({
        messages,
        systemPrompt: fullSystemPrompt,
        temperature: 0.7,
        maxTokens: 1024,
        responseFormat: "text",
      });

      return { response: result.content, tokensUsed: result.tokensUsed };
    } catch (error) {
      console.error(
        "Response generation failed:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return { response: getFallbackResponse(typedIntent.type, typedLanguage), tokensUsed: 0 };
    }
  },
});

function validateLanguage(lang: string): LanguageCode {
  if (lang === "es" || lang === "pt" || lang === "en") {
    return lang;
  }
  return "en";
}

function validateConversationState(state: string | undefined): ConversationState {
  const validStates: ConversationState[] = [
    "idle",
    "browsing",
    "ordering",
    "confirming",
    "payment",
    "completed",
    "escalated",
  ];
  if (state && validStates.includes(state as ConversationState)) {
    return state as ConversationState;
  }
  return "idle";
}

function buildContextInstruction(intent: Intent, products: Product[]): string {
  switch (intent.type) {
    case "greeting":
      return "The customer just greeted you. Respond with a friendly welcome and offer to help.";

    case "product_question": {
      const query = intent.query.toLowerCase();
      const matchingProducts = products.filter(
        (p) =>
          p.available &&
          (p.name.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query))
      );
      if (matchingProducts.length > 0) {
        const productInfo = matchingProducts
          .map((p) => `${p.name}: ${formatPrice(p.price, p.currency)}`)
          .join(", ");
        return `Customer is asking about: "${intent.query}". Matching products: ${productInfo}. Provide helpful information about these products.`;
      }
      return `Customer is asking about: "${intent.query}". No exact matches found. Suggest similar available products or apologize that we don't have that item.`;
    }

    case "order_start": {
      const items = intent.items;
      if (items.length === 0) {
        return "Customer wants to start an order but didn't specify items. Ask what they'd like to order.";
      }
      const itemDescriptions = items
        .map((item) => `${item.quantity}x ${item.productQuery}`)
        .join(", ");
      return `Customer wants to order: ${itemDescriptions}. Confirm the items, look up prices from available products, and provide the total. If any item isn't available, let them know.`;
    }

    case "order_modify":
      return `Customer wants to ${intent.action} "${intent.item}" from their order. Acknowledge the change and confirm the updated order.`;

    case "business_question":
      return `Customer is asking about: ${intent.topic}. Use the business information provided above to answer accurately.`;

    case "escalation_request":
      return "Customer wants to speak with a human. Acknowledge their request and let them know someone will be with them shortly.";

    case "small_talk":
      return "Customer is making small talk. Respond briefly and friendly, then gently redirect to how you can help them.";

    case "unknown":
      return "Customer's intent is unclear. Politely ask for clarification and explain what you can help with (product info, orders, business questions).";

    default:
      return "";
  }
}

function formatPrice(priceInCents: number, currency: string): string {
  const price = priceInCents / 100;
  const currencySymbols: Record<string, string> = {
    USD: "$",
    COP: "COP $",
    BRL: "R$",
    MXN: "MX$",
  };
  const symbol = currencySymbols[currency] ?? currency;
  return `${symbol}${price.toFixed(2)}`;
}

function getFallbackResponse(intentType: string, language: LanguageCode): string {
  const fallbacks: Record<LanguageCode, Record<string, string>> = {
    en: {
      greeting: "Hello! Welcome! How can I help you today?",
      product_question:
        "I'd be happy to help you find what you're looking for. Could you tell me more about what you need?",
      order_start: "I'd be happy to help you place an order. What would you like?",
      order_modify: "I can help you modify your order. What changes would you like to make?",
      business_question:
        "I'd be happy to answer your question. Could you please be more specific?",
      escalation_request:
        "I understand you'd like to speak with someone. Let me connect you with a team member.",
      small_talk: "I'm here to help! Is there anything I can assist you with?",
      unknown:
        "I'm sorry, I didn't quite understand. I can help you with product information, placing orders, or answering questions about our business.",
      default:
        "I'm here to help! Feel free to ask about our products or place an order.",
    },
    es: {
      greeting: "¡Hola! ¡Bienvenido! ¿Cómo puedo ayudarte hoy?",
      product_question:
        "Con gusto te ayudo a encontrar lo que buscas. ¿Podrías contarme más sobre lo que necesitas?",
      order_start: "Con gusto te ayudo a hacer un pedido. ¿Qué te gustaría?",
      order_modify: "Puedo ayudarte a modificar tu pedido. ¿Qué cambios te gustaría hacer?",
      business_question:
        "Con gusto respondo tu pregunta. ¿Podrías ser más específico?",
      escalation_request:
        "Entiendo que te gustaría hablar con alguien. Déjame conectarte con un miembro del equipo.",
      small_talk: "¡Estoy aquí para ayudarte! ¿Hay algo en lo que pueda asistirte?",
      unknown:
        "Lo siento, no entendí bien. Puedo ayudarte con información de productos, pedidos o preguntas sobre nuestro negocio.",
      default:
        "¡Estoy aquí para ayudarte! No dudes en preguntar sobre nuestros productos o hacer un pedido.",
    },
    pt: {
      greeting: "Olá! Bem-vindo! Como posso ajudá-lo hoje?",
      product_question:
        "Ficarei feliz em ajudá-lo a encontrar o que procura. Pode me contar mais sobre o que precisa?",
      order_start: "Ficarei feliz em ajudá-lo a fazer um pedido. O que gostaria?",
      order_modify: "Posso ajudá-lo a modificar seu pedido. Que alterações gostaria de fazer?",
      business_question:
        "Ficarei feliz em responder sua pergunta. Poderia ser mais específico?",
      escalation_request:
        "Entendo que gostaria de falar com alguém. Deixe-me conectá-lo com um membro da equipe.",
      small_talk: "Estou aqui para ajudar! Há algo em que posso ajudá-lo?",
      unknown:
        "Desculpe, não entendi bem. Posso ajudá-lo com informações de produtos, pedidos ou perguntas sobre nosso negócio.",
      default:
        "Estou aqui para ajudar! Fique à vontade para perguntar sobre nossos produtos ou fazer um pedido.",
    },
  };

  const langFallbacks = fallbacks[language];
  return langFallbacks[intentType] ?? langFallbacks["default"] ?? fallbacks.en["default"] ?? "";
}
