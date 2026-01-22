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
  shopifyProductId?: string;
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

// Extract base product name from variant name (e.g., "Hoodie - Small" -> "Hoodie")
function getBaseProductName(name: string): string {
  const dashIndex = name.lastIndexOf(" - ");
  return dashIndex > 0 ? name.substring(0, dashIndex) : name;
}

// Extract variant name from product name (e.g., "Hoodie - Small" -> "Small")
function getVariantName(name: string): string {
  const dashIndex = name.lastIndexOf(" - ");
  return dashIndex > 0 ? name.substring(dashIndex + 3) : "";
}

// Group products by shopifyProductId to identify variants
function groupProductsByVariant(products: Product[]): Map<string, Product[]> {
  const groups = new Map<string, Product[]>();
  
  for (const product of products) {
    // Products with shopifyProductId are grouped by it
    // Products without are considered standalone (manual products)
    const key = product.shopifyProductId ?? `standalone_${product.name}`;
    const existing = groups.get(key) ?? [];
    existing.push(product);
    groups.set(key, existing);
  }
  
  return groups;
}

// Format product catalog with variant grouping
function formatProductCatalog(products: Product[]): string {
  const groups = groupProductsByVariant(products);
  const lines: string[] = [];
  
  for (const [, variants] of groups) {
    const availableVariants = variants.filter((p) => p.available);
    const unavailableVariants = variants.filter((p) => !p.available);
    
    if (availableVariants.length === 0 && unavailableVariants.length === 0) {
      continue;
    }
    
    // Single product (no variants) or standalone manual product
    if (variants.length === 1) {
      const p = variants[0];
      if (!p) continue;
      const price = formatPrice(p.price, p.currency);
      const desc = p.description ? ` - ${p.description}` : "";
      const status = p.available ? "" : " [OUT OF STOCK]";
      lines.push(`  - ${p.name}: ${price}${desc}${status}`);
      continue;
    }
    
    // Multiple variants - group under base product name
    const baseName = getBaseProductName(variants[0]?.name ?? "");
    const description = variants[0]?.description ? ` - ${variants[0].description}` : "";
    
    lines.push(`  - ${baseName}${description} (HAS VARIANTS - ask customer which they want):`);
    
    for (const v of variants) {
      const variantName = getVariantName(v.name);
      const price = formatPrice(v.price, v.currency);
      const status = v.available ? "" : " [OUT OF STOCK]";
      lines.push(`      • ${variantName}: ${price}${status}`);
    }
  }
  
  return lines.join("\n");
}

export function buildAgentPrompt(params: AgentPromptParams): string {
  const { business, products, currentOrder, language, customerPhone } = params;

  const productCatalog = formatProductCatalog(products);

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

### Handling Products with Variants (IMPORTANT)
- Some products have multiple variants (size, color, etc.) - marked with "HAS VARIANTS" in the catalog
- When customer asks for a product that has variants WITHOUT specifying which one:
  1. ALWAYS ask which variant they want before adding to order
  2. List the available options with their prices
  3. Example: "Which size would you like? We have Small ($10), Medium ($12), Large ($14)"
- When customer specifies a variant (e.g., "medium hoodie"), add the FULL product name (e.g., "Hoodie - Medium")
- If a variant is marked [OUT OF STOCK], let the customer know and suggest available alternatives
- NEVER add a generic product name if variants exist - always get the specific variant first

### Edge Cases
- Empty cart + "that's all" → Ask what they'd like to order
- Unknown product → Suggest similar available products
- Unclear quantity → Default to 1, confirm with customer
- Vague requests → Ask clarifying questions naturally
- Customer seems upset → Offer to connect with human
- Customer asks for out-of-stock variant → Apologize and suggest available variants

## Important Rules
1. NEVER invent products - only offer what's in the catalog
2. NEVER submit an order without explicit customer confirmation
3. ALWAYS confirm significant changes to the order
4. If unsure, ASK - don't assume
5. Keep responses SHORT - this is WhatsApp, not email
6. Be helpful even if customer makes typos or uses slang
7. You can use emojis sparingly to be friendly 😊
8. For products with variants, ALWAYS ask which variant before adding to order
9. When adding variant products, use the FULL name (e.g., "Hoodie - Medium", not just "Hoodie")

## Response Format
- Respond naturally as if chatting on WhatsApp
- After using a tool, ALWAYS respond to the customer with the result
- Don't mention "tools" or "functions" to the customer
- Just be helpful and conversational`;
}

export type { BusinessInfo, Product, OrderState, OrderItem, AgentPromptParams, LanguageCode };
