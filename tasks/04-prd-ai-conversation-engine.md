# 04 - AI Conversation Engine - Product Requirements Document

## Overview
The AI brain that understands customer messages, determines intent, and generates appropriate responses. This is the core intelligence that makes Echo work.

## Problem Statement
When a customer sends a message, Echo needs to:
1. Understand what they want (intent)
2. Extract relevant information (entities)
3. Decide what action to take
4. Generate a natural, helpful response
5. Remember conversation context

This must work across languages (Spanish, Portuguese, English) and feel like talking to a knowledgeable employee, not a robot.

## Goals
- Accurate intent classification (>90%)
- Natural, conversational responses (not robotic)
- Multilingual support (auto-detect and respond in same language)
- Context-aware (remembers conversation history)
- Grounded responses (only talks about actual products/info)
- Configurable AI provider (OpenAI, Gemini, Anthropic)
- Cost-efficient (use cheap models where possible)

## Non-Goals (Out of Scope)
- Voice message transcription (later)
- Image understanding (customer sends photo) (later)
- Proactive outreach (AI initiates conversation) (later)
- Learning from corrections (fine-tuning) (later)
- Sentiment analysis for analytics (later)

## User Stories

### Story 1: Answer Product Questions
**As a** customer  
**I want** to ask about products  
**So that** I can decide what to order

**Acceptance Criteria:**
- [ ] "What do you have?" → Lists categories or popular products
- [ ] "How much is X?" → Returns price of specific product
- [ ] "Tell me about X" → Returns product description
- [ ] "Do you have X?" → Confirms availability or suggests alternatives
- [ ] "What's in the X?" → Returns description/ingredients if available
- [ ] Handles misspellings and variations of product names
- [ ] Responds in customer's language

### Story 2: Handle Order Intent
**As a** customer  
**I want** to place an order via chat  
**So that** I can get products delivered

**Acceptance Criteria:**
- [ ] "I want to order X" → Starts order flow
- [ ] "Add X to my order" → Adds to current order
- [ ] Extracts: product name, quantity (default 1 if not specified)
- [ ] Confirms items and prices before proceeding
- [ ] Handles "remove X" or "change quantity"
- [ ] Asks for missing info (delivery address, payment method)
- [ ] Transitions to order completion (Feature 05)

### Story 3: Answer Business Questions
**As a** customer  
**I want** to ask general questions about the business  
**So that** I have the information I need

**Acceptance Criteria:**
- [ ] "What are your hours?" → Business hours
- [ ] "Where are you located?" → Address
- [ ] "Do you deliver to X?" → Delivery info (if configured)
- [ ] "How can I pay?" → Payment methods
- [ ] "How long is delivery?" → Delivery time estimate
- [ ] Responds with configured business info or "I don't have that information"

### Story 4: Handle Greetings and Small Talk
**As a** customer  
**I want** natural conversation  
**So that** it feels human, not robotic

**Acceptance Criteria:**
- [ ] "Hola" / "Hi" → Friendly greeting with offer to help
- [ ] "Thanks" → Acknowledges politely
- [ ] "Bye" → Friendly farewell
- [ ] Handles common small talk naturally
- [ ] Stays on-brand (uses business's configured tone)

### Story 5: Handle Unknown/Off-Topic
**As a** customer  
**I want** helpful responses even when AI can't help  
**So that** I'm not stuck

**Acceptance Criteria:**
- [ ] Unrelated questions → Politely redirects to what AI can help with
- [ ] Genuinely confused → Offers to connect with human
- [ ] Complaint/angry tone → Empathizes and offers human help
- [ ] Never makes up information not in its knowledge base

### Story 6: Multilingual Support
**As a** customer  
**I want** to chat in my preferred language  
**So that** communication is easy

**Acceptance Criteria:**
- [ ] Auto-detects language from first message
- [ ] Responds in same language throughout conversation
- [ ] Supports: Spanish, Portuguese, English (minimum)
- [ ] Product names stay as-is (don't translate "Hamburguesa Clásica")
- [ ] If business only supports certain languages, respond in default language

### Story 7: Escalation Detection
**As a** customer who needs human help  
**I want** the AI to recognize this  
**So that** I get transferred appropriately

**Acceptance Criteria:**
- [ ] "I want to talk to a person" → Immediate escalation
- [ ] "This is urgent" → Escalation
- [ ] Repeated failures (AI can't understand 3+ times) → Escalation
- [ ] Angry/frustrated tone detected → Offer escalation
- [ ] When escalating: notify business, mark conversation, graceful handoff message

## Technical Requirements

### AI Provider Abstraction
```typescript
// packages/backend/convex/ai/types.ts
interface AIProvider {
  complete(params: {
    messages: Message[];
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "text" | "json";
  }): Promise<string>;
}

// Implementations
class OpenAIProvider implements AIProvider { ... }
class GeminiProvider implements AIProvider { ... }
class AnthropicProvider implements AIProvider { ... }
```

### Environment Variables
```bash
AI_PROVIDER=openai  # "openai" | "gemini" | "anthropic"
AI_MODEL=gpt-4o-mini  # model name
OPENAI_API_KEY=xxx
GOOGLE_AI_API_KEY=xxx  # for Gemini
ANTHROPIC_API_KEY=xxx
```

### Model Selection Strategy
| Task | Recommended Model | Why |
|------|-------------------|-----|
| Intent classification | gpt-4o-mini / gemini-1.5-flash | Fast, cheap, structured output |
| Response generation | gpt-4o-mini / gemini-1.5-flash | Good enough for most cases |
| Complex reasoning | gpt-4o (fallback) | When cheaper model struggles |

### Intent Classification
```typescript
type Intent = 
  | { type: "greeting" }
  | { type: "product_question"; query: string }
  | { type: "order_start"; items: OrderItem[] }
  | { type: "order_modify"; action: "add" | "remove" | "change"; item: OrderItem }
  | { type: "business_question"; topic: string }
  | { type: "escalation_request" }
  | { type: "small_talk" }
  | { type: "unknown" };

interface OrderItem {
  productQuery: string;  // What customer said
  quantity: number;
}
```

### Conversation State Machine
```
IDLE → BROWSING → ORDERING → CONFIRMING → PAYMENT → COMPLETED
  ↓        ↓          ↓           ↓          ↓
  └────────┴──────────┴───────────┴──────────┴→ ESCALATED
```

### System Prompt Structure
```typescript
const systemPrompt = `
You are an assistant for ${business.name}, a ${business.type}.

## Your Role
- Help customers learn about products and place orders
- Be friendly, helpful, and conversational
- Respond in the same language the customer uses

## Business Information
- Hours: ${business.hours}
- Location: ${business.address}
- Delivery: ${business.deliveryInfo}

## Products
${products.map(p => `- ${p.name}: ${formatPrice(p.price)} - ${p.description}`).join('\n')}

## Current Conversation State
${conversationState}

## Rules
- Only mention products that exist in the list above
- If you don't know something, say so honestly
- If customer seems frustrated, offer to connect with a human
- Never make up prices or availability

## Tone
${business.aiTone || "Friendly and professional"}
`;
```

### API Endpoints (Convex Functions)

```typescript
// Main entry point - called when message received
ai.processMessage({ conversationId, message }) 
  // Returns: { response: string, intent: Intent, shouldEscalate: boolean }

// Internal functions
ai.classifyIntent({ message, conversationHistory, products })
ai.generateResponse({ intent, conversationHistory, businessContext, products })
ai.detectEscalation({ message, conversationHistory })

// Actions (external AI API calls)
ai.callAIProvider({ messages, systemPrompt, responseFormat })
```

## Data Model

### Updates to `conversations` table
| Field | Type | Description |
|-------|------|-------------|
| state | string | "idle" \| "browsing" \| "ordering" \| "confirming" \| "payment" \| "completed" \| "escalated" |
| detectedLanguage | string | "es" \| "pt" \| "en" |
| pendingOrder | object | { items: [], deliveryAddress?, paymentMethod? } |
| escalationReason | string | Why escalated (if applicable) |

### `aiLogs` table (for debugging/improvement)
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Convex document ID |
| conversationId | Id<"conversations"> | Related conversation |
| messageId | Id<"messages"> | Triggering message |
| intent | object | Classified intent |
| prompt | string | Full prompt sent to AI |
| response | string | AI response |
| model | string | Model used |
| tokensUsed | number | For cost tracking |
| latencyMs | number | Response time |
| createdAt | number | Timestamp |

## UI/UX

### Business Settings (AI Configuration)
- `/settings/ai` page
- Configure: AI tone/personality
- Configure: Custom greeting message
- Configure: Escalation triggers
- View: AI usage stats (tokens, cost estimate)

### Components
- `AISettingsForm` - Configure AI behavior
- `UsageStats` - Show token usage and costs

## Performance Requirements
- Intent classification: < 500ms
- Response generation: < 2s
- Total message processing: < 3s (including DB operations)

## Success Metrics
- Intent classification accuracy > 90%
- Customer satisfaction (escalation rate < 10%)
- Average response time < 3s
- Cost per conversation < $0.05

## Dependencies
- Feature 01 (Business Onboarding) - business context
- Feature 02 (Product CMS) - product data for grounding
- Feature 03 (WhatsApp Integration) - message input/output

## Testing Strategy
- Unit tests for intent classification with test cases
- Integration tests for full conversation flows
- Golden tests: save good conversation examples, ensure no regression

## Open Questions
- Should we cache common responses to reduce AI calls?
- How to handle AI provider outages (fallback)?
- Should we show "typing..." indicator while AI thinks?
- Do we need content moderation for AI responses?
