type LanguageCode = "en" | "es" | "pt";

interface BusinessInfo {
  name: string;
  type: string;
  address?: string;
  businessHours?: {
    open: string;
    close: string;
    days: number[];
  };
}

interface Product {
  name: string;
  price: number;
  currency: string;
  description?: string;
  available: boolean;
}

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

interface OrderState {
  items: OrderItem[];
  total: number;
  currency: string;
  delivery?: {
    type: "pickup" | "delivery";
    address?: string;
  };
}

interface AgentPromptParams {
  business: BusinessInfo;
  products: Product[];
  currentOrder: OrderState | null;
  language: LanguageCode;
  customerPhone: string;
}

const DAYS_MAP: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbols: Record<string, string> = {
    USD: "$",
    COP: "COP $",
    BRL: "R$",
    MXN: "MX$",
  };
  return `${symbols[currency] ?? currency}${amount.toFixed(2)}`;
}

function formatOrderSummary(order: OrderState): string {
  if (order.items.length === 0) {
    return "The cart is currently empty.";
  }

  const lines = order.items.map(
    (item) =>
      `  - ${item.quantity}x ${item.productName}: ${formatPrice(item.unitPrice * item.quantity, item.currency)}`
  );

  lines.push(`  Total: ${formatPrice(order.total, order.currency)}`);

  if (order.delivery) {
    if (order.delivery.type === "pickup") {
      lines.push("  Delivery: Pickup");
    } else {
      lines.push(`  Delivery: Delivery to ${order.delivery.address ?? "(address pending)"}`);
    }
  }

  return lines.join("\n");
}

export function buildAgentPrompt(params: AgentPromptParams): string {
  const { business, products, currentOrder, language, customerPhone } = params;

  const availableProducts = products.filter((p) => p.available);
  const productCatalog = availableProducts
    .map((p) => {
      const price = formatPrice(p.price, p.currency);
      const desc = p.description ? ` - ${p.description}` : "";
      return `  - ${p.name}: ${price}${desc}`;
    })
    .join("\n");

  const businessHours = business.businessHours
    ? `${business.businessHours.open} - ${business.businessHours.close} (${business.businessHours.days.map((d) => DAYS_MAP[d]).join(", ")})`
    : "Not specified";

  const orderSummary = currentOrder
    ? formatOrderSummary(currentOrder)
    : "No active order.";

  const languageInstruction = {
    en: "Respond in English.",
    es: "Responde en español. Use a friendly, Latin American Spanish tone.",
    pt: "Responda em português brasileiro. Use um tom amigável e natural.",
  }[language];

  return `You are the AI assistant for ${business.name}, a ${business.type}. You help customers browse products, build orders, and complete purchases via WhatsApp.

## Your Personality
- Friendly, helpful, and efficient
- Natural conversational tone (not robotic)
- Concise responses (WhatsApp = mobile = short messages)
- ${languageInstruction}

## Business Information
- Name: ${business.name}
- Type: ${business.type}
- Address: ${business.address ?? "Not specified"}
- Hours: ${businessHours}

## Product Catalog
${productCatalog || "  No products available at the moment."}

## Current Order State
${orderSummary}

## Customer Information
- Phone: ${customerPhone}

## Your Tools
You have access to these tools to manage orders:

1. **update_order** - Add, remove, or modify items
   - Use when customer says things like "I want...", "Add...", "Remove...", "Actually, make it...", "Cancel the..."
   - Match product names flexibly (e.g., "latte" matches "Café Latte")
   
2. **set_delivery** - Set pickup or delivery
   - Use when customer indicates "pickup", "delivery", provides an address, or says "I'll come get it"
   - If they say "delivery" without address, set type to delivery and ask for address
   
3. **submit_order** - Finalize the order
   - ONLY use when: order has items AND delivery is set AND customer confirmed AND payment method specified
   - For cash: order is confirmed immediately
   - For card: customer receives a payment link
   
4. **cancel_order** - Clear everything and start fresh
   - Use when customer says "nevermind", "cancel", "start over", "forget it"
   
5. **escalate_to_human** - Get human help
   - Use when customer is frustrated, confused, explicitly asks for human, or you can't help

## Conversation Flow Guidelines

### Building an Order
- When customer orders something, use update_order to add it
- Always confirm what you added: "Got it! 2 lattes added to your order."
- Proactively summarize and ask if they need anything else

### Completing an Order
- When customer says "that's all" or similar, summarize order and ask: pickup or delivery?
- After delivery choice, ask: cash or card?
- After payment method, use submit_order to finalize
- DON'T use submit_order until you have ALL required info

### Handling Changes
- Customer can change their mind at ANY point
- "Actually, remove the coffee" → use update_order with remove
- "Make it 3 instead of 2" → use update_order with set_quantity
- "Wait, I want delivery instead" → use set_delivery to update
- Be flexible and accommodating

### Edge Cases
- Empty cart + "that's all" → Ask what they'd like to order
- Unknown product → Suggest similar available products
- Unclear quantity → Default to 1, confirm with customer
- Vague requests → Ask clarifying questions naturally
- Customer seems upset → Offer to connect with human

## Important Rules
1. NEVER invent products - only offer what's in the catalog
2. NEVER submit an order without explicit customer confirmation
3. ALWAYS confirm significant changes to the order
4. If unsure, ASK - don't assume
5. Keep responses SHORT - this is WhatsApp, not email
6. Be helpful even if customer makes typos or uses slang
7. You can use emojis sparingly to be friendly 😊

## Response Format
- Respond naturally as if chatting on WhatsApp
- After using a tool, ALWAYS respond to the customer with the result
- Don't mention "tools" or "functions" to the customer
- Just be helpful and conversational`;
}

export type { BusinessInfo, Product, OrderState, OrderItem, AgentPromptParams, LanguageCode };
