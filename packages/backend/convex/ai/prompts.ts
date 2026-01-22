type ConversationState =
  | "idle"
  | "browsing"
  | "ordering"
  | "confirming"
  | "payment"
  | "completed"
  | "escalated";

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
  aiGreeting?: string;
  aiTone?: string;
}

interface Product {
  name: string;
  price: number;
  currency: string;
  description?: string;
  available: boolean;
  shopifyProductId?: string;
}

interface BuildSystemPromptParams {
  business: BusinessInfo;
  products: Product[];
  conversationState: ConversationState;
  detectedLanguage: LanguageCode;
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

function getBaseProductName(name: string): string {
  const dashIndex = name.lastIndexOf(" - ");
  return dashIndex > 0 ? name.substring(0, dashIndex) : name;
}

function getVariantName(name: string): string {
  const dashIndex = name.lastIndexOf(" - ");
  return dashIndex > 0 ? name.substring(dashIndex + 3) : "";
}

function groupProductsByVariant(products: Product[]): Map<string, Product[]> {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = product.shopifyProductId ?? `standalone_${product.name}`;
    const existing = groups.get(key) ?? [];
    existing.push(product);
    groups.set(key, existing);
  }
  return groups;
}

function formatProductCatalogWithVariants(products: Product[]): string {
  const groups = groupProductsByVariant(products);
  const lines: string[] = [];
  
  for (const [, variants] of groups) {
    if (variants.length === 1) {
      const p = variants[0];
      if (!p) continue;
      const price = formatPrice(p.price, p.currency);
      const desc = p.description ? ` - ${p.description}` : "";
      const status = p.available ? "" : " [OUT OF STOCK]";
      lines.push(`- ${p.name}: ${price}${desc}${status}`);
      continue;
    }
    
    const baseName = getBaseProductName(variants[0]?.name ?? "");
    const description = variants[0]?.description ? ` - ${variants[0].description}` : "";
    lines.push(`- ${baseName}${description} (HAS VARIANTS):`);
    
    for (const v of variants) {
      const variantName = getVariantName(v.name);
      const price = formatPrice(v.price, v.currency);
      const status = v.available ? "" : " [OUT OF STOCK]";
      lines.push(`    • ${variantName}: ${price}${status}`);
    }
  }
  
  return lines.length > 0 ? lines.join("\n") : "";
}

const LANGUAGE_INSTRUCTION: Record<LanguageCode, string> = {
  en: "Respond in English.",
  es: "Responde en español.",
  pt: "Responda em português.",
};

const STATE_CONTEXT: Record<ConversationState, string> = {
  idle: "The customer just started the conversation.",
  browsing: "The customer is browsing products and asking questions.",
  ordering: "The customer is building an order.",
  confirming: "The customer is reviewing their order before confirming.",
  payment: "The customer is in the payment process.",
  completed: "The order has been completed.",
  escalated: "This conversation has been escalated to a human agent.",
};

export function buildSystemPrompt(params: BuildSystemPromptParams): string {
  const { business, products, conversationState, detectedLanguage } = params;

  const sections: string[] = [];

  sections.push(`You are a helpful customer service assistant for ${business.name}, a ${business.type}.`);

  if (business.aiTone) {
    sections.push(`Your tone should be: ${business.aiTone}`);
  } else {
    sections.push("Be friendly, helpful, and professional.");
  }

  sections.push(LANGUAGE_INSTRUCTION[detectedLanguage]);

  sections.push("\n## Business Information");
  sections.push(`Business: ${business.name}`);
  sections.push(`Type: ${business.type}`);

  if (business.address) {
    sections.push(`Address: ${business.address}`);
  }

  if (business.businessHours) {
    const { open, close, days } = business.businessHours;
    const dayNames = days.map((d) => DAYS_MAP[d] ?? `Day ${d}`).join(", ");
    sections.push(`Hours: ${open} - ${close} (${dayNames})`);
  }

  sections.push("\n## Available Products");
  if (products.length > 0) {
    const catalogFormatted = formatProductCatalogWithVariants(products);
    if (catalogFormatted) {
      sections.push(catalogFormatted);
    } else {
      sections.push("No products currently available.");
    }
  } else {
    sections.push("Product catalog is being updated.");
  }

  sections.push(`\n## Current Conversation State`);
  sections.push(STATE_CONTEXT[conversationState]);

  sections.push("\n## Rules");
  sections.push("1. Only mention products that are in the available products list above.");
  sections.push("2. If you're unsure about something, admit it and offer to connect the customer with a human.");
  sections.push("3. If the customer seems frustrated or angry, offer to connect them with a human agent.");
  sections.push("4. Keep responses concise and helpful.");
  sections.push("5. Never make up product information - use only what's provided above.");
  sections.push("6. For orders, always confirm the items and total price before proceeding.");
  sections.push("7. For products with variants (marked 'HAS VARIANTS'), ALWAYS ask which variant the customer wants before adding to their order.");
  sections.push("8. When a variant is [OUT OF STOCK], apologize and suggest available alternatives.");

  if (business.aiGreeting && conversationState === "idle") {
    sections.push(`\n## Suggested Greeting`);
    sections.push(business.aiGreeting);
  }

  return sections.join("\n");
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
  return `${symbol}${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export type {
  BusinessInfo,
  Product,
  BuildSystemPromptParams,
  ConversationState,
  LanguageCode,
};
