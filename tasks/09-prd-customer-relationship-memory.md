# 09 - Customer Relationship Memory - Product Requirements Document

## Overview
A persistent customer memory system that enables the AI to recognize repeat customers, remember their preferences, suggest saved addresses, and provide VIP-level personalized service. This transforms Echo from a transactional bot into a relationship-building assistant.

## Problem Statement
Currently, Echo treats every conversation as if it's the first interaction:
1. Customers must re-type their delivery address every order
2. AI doesn't remember dietary preferences ("no onions please" - every time)
3. Loyal customers get the same generic experience as first-timers
4. Business owners can't add notes about customers ("friend of owner", "always tips well")
5. No way to identify VIP customers who deserve special treatment
6. AI can't reference past orders ("your usual?")

For LATAM businesses where personal relationships drive loyalty, this is a critical gap.

## Goals
- Persistent customer profiles linked by phone number (WhatsApp ID)
- Saved addresses with smart suggestions ("Deliver to your usual?")
- AI memory of preferences, restrictions, and behavior patterns
- VIP/tier system with personalized AI treatment
- Business notes visible to AI for context
- Token-efficient retrieval (don't blow context window)
- Conversation history accessible via search tool (not always loaded)
- Auto-extraction of facts from conversations
- LGPD/privacy compliant (Brazil market)

## Non-Goals (Out of Scope)
- Customer login/accounts (they're identified by WhatsApp phone)
- Customer-facing profile management (they interact via chat only)
- Marketing campaigns/segmentation (later)
- Loyalty points/rewards program (later)
- Cross-business customer data sharing (each business has isolated data)
- Customer data export/import (later)
- Predictive analytics ("likely to order on Fridays") (later)

## User Stories

### Story 1: Recognize Returning Customer
**As a** returning customer  
**I want** the AI to recognize me  
**So that** I feel valued and don't start from scratch

**Acceptance Criteria:**
- [ ] First message from known phone triggers customer lookup
- [ ] If found: AI greeting includes name (if known): "Hola Maria! Bueno verte de nuevo"
- [ ] If VIP: AI adjusts tone to be more personal/appreciative
- [ ] Customer profile loaded into AI context automatically
- [ ] If new customer: create profile record, proceed normally
- [ ] Works across conversations (memory persists after conversation ends)

### Story 2: Saved Addresses
**As a** repeat customer  
**I want** to reuse my delivery address  
**So that** I don't type it every time

**Acceptance Criteria:**
- [ ] After first delivery, address saved to customer profile
- [ ] On next order: "Deliver to Calle 85 #15-30 (home)?" 
- [ ] Customer can confirm with "yes" / "sí" / "sim"
- [ ] Customer can say "no, different address" and provide new one
- [ ] New addresses saved automatically with AI-generated label
- [ ] Customer can have multiple addresses (home, work, mom's house)
- [ ] Can set default address
- [ ] AI suggests most recently used address first

### Story 3: Remember Preferences
**As a** customer with specific preferences  
**I want** the AI to remember them  
**So that** I don't repeat myself every order

**Acceptance Criteria:**
- [ ] AI extracts preferences from conversation: "sin cebolla por favor" → stores "no onions"
- [ ] Stored preferences loaded into AI context
- [ ] AI proactively applies: "Your usual burger without onions?"
- [ ] Supports: dietary restrictions, allergies, spice level, common modifications
- [ ] AI asks for confirmation before assuming: "Still no onions, right?"
- [ ] Customer can update preferences: "Actually, onions are fine now"
- [ ] Preference removed when customer explicitly changes it

### Story 4: Remember Dietary Restrictions & Allergies
**As a** customer with allergies  
**I want** the AI to always remember  
**So that** I stay safe

**Acceptance Criteria:**
- [ ] Allergy mentions trigger high-confidence memory storage
- [ ] Allergies prominently displayed in AI context (safety critical)
- [ ] AI warns if customer orders something with known allergen
- [ ] AI suggests alternatives: "That has peanuts - would you like the almond version?"
- [ ] Never "forgets" allergies (requires explicit removal)
- [ ] Business dashboard shows customer allergies prominently

### Story 5: VIP Customer Treatment
**As a** business owner  
**I want** loyal customers treated specially  
**So that** they feel appreciated and keep coming back

**Acceptance Criteria:**
- [ ] Customers have tier: regular | bronze | silver | gold | vip
- [ ] Auto-tier based on: order count, total spend, frequency
- [ ] Manual override: business can promote/demote customers
- [ ] AI tone adapts to tier:
  - Regular: Professional, helpful
  - Bronze: Slightly warmer, use name
  - Silver: Acknowledge loyalty, personalized greetings
  - Gold: Very personal, proactive suggestions, thank for loyalty
  - VIP: White-glove service, apologize profusely for any issue
- [ ] VIP customers flagged in conversation dashboard
- [ ] Configurable tier thresholds per business

### Story 6: Business Notes on Customers
**As a** business owner/staff  
**I want** to add notes about customers  
**So that** the AI has context I know

**Acceptance Criteria:**
- [ ] Dashboard: add/edit notes on customer profile
- [ ] Notes visible to AI in context
- [ ] Examples: "Friend of owner - always give extra", "Complained last time, be careful"
- [ ] Notes timestamped and attributed to staff member
- [ ] AI uses notes naturally (doesn't say "my notes say...")
- [ ] Sensitive notes can be marked "staff only" (not shown to AI)

### Story 7: Order History Context
**As a** returning customer  
**I want** to reference past orders  
**So that** reordering is easy

**Acceptance Criteria:**
- [ ] "Lo mismo que la última vez" → AI retrieves last order, confirms
- [ ] "Mi pedido usual" → AI identifies most common order pattern
- [ ] "What did I order last month?" → AI can search and answer
- [ ] Order history summary in customer profile
- [ ] AI can reference: "Last time you got the burger combo - want that again?"
- [ ] Works across multiple conversations

### Story 8: Conversation History Search
**As an** AI assistant  
**I want** to search past conversations  
**So that** I can recall specific interactions when relevant

**Acceptance Criteria:**
- [ ] AI has `search_customer_history` tool
- [ ] Searches conversation summaries and messages
- [ ] Returns relevant excerpts with context
- [ ] Token-efficient: only retrieves what's needed
- [ ] Example: Customer says "remember that issue with the cold fries?" → AI searches, finds, acknowledges
- [ ] Search scoped to current customer only
- [ ] Relevance-ranked results

### Story 9: Conversation Summaries
**As a** system  
**I want** to summarize conversations when they end  
**So that** memory is token-efficient

**Acceptance Criteria:**
- [ ] When conversation closes: AI generates summary
- [ ] Summary captures: what was ordered, any issues, preferences mentioned, sentiment
- [ ] Summary stored in `conversationSummaries` table
- [ ] Summaries searchable by AI tool
- [ ] Summary generation is async (doesn't block conversation close)
- [ ] Summary ~100-200 words max (token efficient)

### Story 10: Memory Fact Extraction
**As a** system  
**I want** to extract structured facts from conversations  
**So that** memory is actionable

**Acceptance Criteria:**
- [ ] After conversation: extract facts using AI
- [ ] Fact categories: preference, restriction, allergy, behavior, complaint
- [ ] Facts stored with confidence score (0.0-1.0)
- [ ] High-confidence facts (>0.8) added automatically
- [ ] Low-confidence facts flagged for review (or discarded)
- [ ] Source conversation linked for traceability
- [ ] Deduplication: don't store "no onions" twice
- [ ] Contradictions detected: "likes spicy" vs "no spicy" → flag for resolution

### Story 11: Customer Profile Dashboard
**As a** business owner/staff  
**I want** to view and manage customer profiles  
**So that** I understand my customers

**Acceptance Criteria:**
- [ ] `/customers` page - list all customers
- [ ] Searchable by name, phone
- [ ] Filterable by tier, last order date
- [ ] Sortable by total orders, total spend, last seen
- [ ] `/customers/[id]` - customer detail page
- [ ] Shows: profile info, addresses, preferences, notes, order history, conversation history
- [ ] Edit: name, tier (manual), addresses, preferences, notes
- [ ] Delete customer (with data retention warning)

### Story 12: Privacy & Data Management
**As a** customer (implied via business)  
**I want** my data handled responsibly  
**So that** my privacy is respected

**Acceptance Criteria:**
- [ ] "Forget me" request via chat triggers data deletion workflow
- [ ] Business notified of deletion request
- [ ] Data deleted: profile, addresses, preferences, conversation summaries
- [ ] Order history retained (legal/accounting) but anonymized
- [ ] Data retention configurable per business (30/60/90/365 days of inactivity)
- [ ] LGPD compliance for Brazil market
- [ ] No cross-business data sharing

## Technical Requirements

### AI Context Loading Strategy

```typescript
// What's loaded into every AI request
interface CustomerContext {
  // ALWAYS LOADED (~200-500 tokens)
  profile: {
    name: string | null;
    phone: string;
    tier: CustomerTier;
    preferredLanguage: string;
    firstSeenAt: number;
    lastSeenAt: number;
    totalOrders: number;
    totalSpent: number;
  };
  
  // ALWAYS LOADED (~100-300 tokens)
  addresses: Array<{
    label: string;
    address: string;
    isDefault: boolean;
  }>;
  
  // ALWAYS LOADED (~200-500 tokens) - CRITICAL INFO
  memory: {
    allergies: string[];      // Always show (safety)
    restrictions: string[];   // Dietary restrictions
    preferences: string[];    // "extra spicy", "no onions"
    behaviors: string[];      // "always pays cash", "orders on Fridays"
  };
  
  // ALWAYS LOADED if exists (~100-200 tokens)
  businessNotes: string | null;
  
  // LOADED ON DEMAND via tool
  recentOrders: Array<OrderSummary>;        // Last 3-5 orders
  conversationSummaries: Array<Summary>;    // Searchable
  fullMessageHistory: never;                // Tool access only
}

// Total always-loaded: ~600-1500 tokens (very manageable)
```

### AI Tools for Memory Access

```typescript
// New tools added to AI agent
const customerMemoryTools = [
  {
    name: "search_customer_history",
    description: "Search past conversations with this customer. Use when customer references past interactions.",
    parameters: {
      query: { type: "string", description: "What to search for" },
      limit: { type: "number", description: "Max results (default 3)" }
    }
  },
  {
    name: "get_recent_orders", 
    description: "Get customer's recent orders. Use when customer wants to reorder or asks about past orders.",
    parameters: {
      limit: { type: "number", description: "Number of orders (default 5)" }
    }
  },
  {
    name: "save_customer_preference",
    description: "Save a preference the customer mentioned. Use when customer states a preference.",
    parameters: {
      category: { type: "string", enum: ["allergy", "restriction", "preference", "behavior"] },
      fact: { type: "string", description: "The preference to save" }
    }
  },
  {
    name: "update_customer_address",
    description: "Save or update a delivery address. Use after successful delivery to new address.",
    parameters: {
      address: { type: "string" },
      label: { type: "string", description: "e.g., 'home', 'work'" },
      setAsDefault: { type: "boolean" }
    }
  }
];
```

### VIP Tier Thresholds (Default, Configurable)

```typescript
const DEFAULT_TIER_THRESHOLDS = {
  bronze: { orders: 3, spend: 50000 },   // 3+ orders OR $50+ spent
  silver: { orders: 10, spend: 200000 }, // 10+ orders OR $200+ spent
  gold: { orders: 25, spend: 500000 },   // 25+ orders OR $500+ spent
  vip: { orders: 50, spend: 1000000 },   // 50+ orders OR $1000+ spent (or manual)
};

// Tier calculation
function calculateTier(customer: Customer, thresholds: TierThresholds): CustomerTier {
  if (customer.manualTier) return customer.manualTier;
  
  if (customer.totalOrders >= thresholds.vip.orders || 
      customer.totalSpent >= thresholds.vip.spend) return "vip";
  if (customer.totalOrders >= thresholds.gold.orders || 
      customer.totalSpent >= thresholds.gold.spend) return "gold";
  // ... etc
  return "regular";
}
```

### System Prompt Additions for VIP

```typescript
function getVIPPromptSection(customer: CustomerContext): string {
  if (customer.profile.tier === "regular") return "";
  
  const tierMessages = {
    bronze: `${customer.profile.name || "This customer"} has ordered ${customer.profile.totalOrders} times. Use their name and be friendly.`,
    
    silver: `${customer.profile.name || "This customer"} is a Silver member (${customer.profile.totalOrders} orders). Acknowledge their loyalty subtly. Be warm and personalized.`,
    
    gold: `${customer.profile.name || "This customer"} is a Gold member (${customer.profile.totalOrders} orders, $${customer.profile.totalSpent / 100} lifetime). They're a valued regular. Be very personal, thank them for their loyalty, offer your best service.`,
    
    vip: `⭐ VIP CUSTOMER ⭐
${customer.profile.name || "This customer"} is a VIP (${customer.profile.totalOrders} orders, $${customer.profile.totalSpent / 100} lifetime).
- Use their name naturally
- Acknowledge their loyalty warmly
- Be extremely accommodating with any request
- If ANY issue arises: apologize profusely, offer compensation
- They deserve white-glove service`
  };
  
  return `\n## Customer Status\n${tierMessages[customer.profile.tier]}`;
}
```

### Memory Extraction Pipeline

```typescript
// Triggered when conversation is closed
async function processConversationMemory(conversationId: Id<"conversations">) {
  // 1. Generate summary
  const summary = await generateConversationSummary(conversationId);
  await db.insert("conversationSummaries", {
    conversationId,
    customerId: conversation.customerId,
    summary: summary.text,
    sentiment: summary.sentiment,
    keyEvents: summary.events,
    createdAt: Date.now(),
  });
  
  // 2. Extract facts
  const facts = await extractMemoryFacts(conversationId);
  for (const fact of facts) {
    if (fact.confidence > 0.8) {
      // Check for duplicates
      const existing = await findSimilarFact(customerId, fact);
      if (!existing) {
        await db.insert("customerMemory", {
          customerId,
          category: fact.category,
          fact: fact.text,
          confidence: fact.confidence,
          source: "ai_extracted",
          extractedFrom: conversationId,
          createdAt: Date.now(),
        });
      }
    }
  }
  
  // 3. Update customer stats
  const orders = await getConversationOrders(conversationId);
  if (orders.length > 0) {
    await updateCustomerStats(customerId, orders);
  }
  
  // 4. Check tier upgrade
  await checkAndUpdateTier(customerId);
}
```

### API Endpoints (Convex Functions)

```typescript
// Customer queries
customers.get({ customerId })
customers.getByPhone({ businessId, phone })
customers.list({ businessId, search?, tier?, sortBy?, cursor? })
customers.getContext({ customerId }) // For AI - returns CustomerContext

// Customer mutations  
customers.create({ businessId, phone, name? })
customers.update({ customerId, name?, tier?, preferredLanguage? })
customers.delete({ customerId }) // GDPR/LGPD deletion
customers.anonymize({ customerId }) // Keep orders, remove PII

// Address management
customerAddresses.list({ customerId })
customerAddresses.add({ customerId, address, label, isDefault? })
customerAddresses.update({ addressId, address?, label?, isDefault? })
customerAddresses.delete({ addressId })
customerAddresses.setDefault({ addressId })

// Memory management
customerMemory.list({ customerId, category? })
customerMemory.add({ customerId, category, fact, source })
customerMemory.update({ memoryId, fact?, confidence? })
customerMemory.delete({ memoryId })

// Notes management
customerNotes.list({ customerId })
customerNotes.add({ customerId, note, staffOnly? })
customerNotes.update({ noteId, note?, staffOnly? })
customerNotes.delete({ noteId })

// Conversation summaries
conversationSummaries.get({ conversationId })
conversationSummaries.search({ customerId, query, limit? })
conversationSummaries.generate({ conversationId }) // Manual trigger

// AI tools (internal actions)
ai.searchCustomerHistory({ customerId, query, limit })
ai.getRecentOrders({ customerId, limit })
ai.saveCustomerPreference({ customerId, category, fact })
```

## Data Model

### `customers` table (NEW)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| businessId | Id<"businesses"> | yes | Parent business |
| phone | string | yes | WhatsApp phone (E.164 format) |
| name | string | no | Customer name (learned or manual) |
| preferredLanguage | string | no | "es" \| "pt" \| "en" |
| tier | string | yes | "regular" \| "bronze" \| "silver" \| "gold" \| "vip" |
| manualTier | string | no | Override calculated tier |
| tierUpdatedAt | number | no | When tier last changed |
| totalOrders | number | yes | Lifetime order count |
| totalSpent | number | yes | Lifetime spend (smallest currency unit) |
| averageOrderValue | number | no | Calculated average |
| lastOrderAt | number | no | Most recent order timestamp |
| firstSeenAt | number | yes | First interaction |
| lastSeenAt | number | yes | Most recent interaction |
| createdAt | number | yes | Record creation |
| updatedAt | number | yes | Last update |

**Indexes:**
- `by_business`: [businessId]
- `by_business_phone`: [businessId, phone] (unique lookup)
- `by_business_tier`: [businessId, tier]
- `by_business_last_seen`: [businessId, lastSeenAt]

### `customerAddresses` table (NEW)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| customerId | Id<"customers"> | yes | Parent customer |
| label | string | yes | "home" \| "work" \| custom |
| address | string | yes | Full address text |
| isDefault | boolean | yes | Primary address |
| lastUsedAt | number | no | For sorting suggestions |
| createdAt | number | yes | Record creation |

**Indexes:**
- `by_customer`: [customerId]

### `customerMemory` table (NEW)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| customerId | Id<"customers"> | yes | Parent customer |
| category | string | yes | "allergy" \| "restriction" \| "preference" \| "behavior" \| "complaint" |
| fact | string | yes | The memory fact |
| confidence | number | yes | 0.0-1.0 (for AI-extracted) |
| source | string | yes | "ai_extracted" \| "manual" \| "order_history" |
| extractedFrom | Id<"conversations"> | no | Source conversation |
| createdAt | number | yes | Record creation |
| updatedAt | number | no | Last update |

**Indexes:**
- `by_customer`: [customerId]
- `by_customer_category`: [customerId, category]

### `customerNotes` table (NEW)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| customerId | Id<"customers"> | yes | Parent customer |
| note | string | yes | Free-text note |
| addedBy | string | yes | User ID who added |
| staffOnly | boolean | yes | If true, not shown to AI |
| createdAt | number | yes | Record creation |

**Indexes:**
- `by_customer`: [customerId]

### `conversationSummaries` table (NEW)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| conversationId | Id<"conversations"> | yes | Source conversation |
| customerId | Id<"customers"> | yes | For customer lookup |
| summary | string | yes | AI-generated summary |
| sentiment | string | no | "positive" \| "neutral" \| "negative" |
| keyEvents | array | no | ["complaint", "refund", "compliment", etc] |
| orderIds | array | no | Orders placed in this conversation |
| createdAt | number | yes | Record creation |

**Indexes:**
- `by_conversation`: [conversationId]
- `by_customer`: [customerId]

### Updates to `conversations` table
| Field | Type | Description |
|-------|------|-------------|
| customerId | Id<"customers"> | **CHANGE**: Now references customers table (was string phone) |

### Updates to `orders` table
| Field | Type | Description |
|-------|------|-------------|
| customerId | Id<"customers"> | **ADD**: Link to customer record |

## UI/UX

### Customer List Page (`/customers`)

```
┌─────────────────────────────────────────────────────────────────┐
│ Customers                                      [Search...    🔍] │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [All Tiers ▼] [Last 30 days ▼]    Sort: [Last seen ▼]   │
├─────────────────────────────────────────────────────────────────┤
│ ⭐ Maria Garcia          Gold    │ 32 orders │ $450.00 │ 2h ago │
│    +57 300 123 4567              │           │         │        │
├─────────────────────────────────────────────────────────────────┤
│    Carlos Rodriguez      Silver  │ 15 orders │ $180.00 │ 1d ago │
│    +57 301 234 5678              │           │         │        │
├─────────────────────────────────────────────────────────────────┤
│    Ana Martinez          Regular │  2 orders │  $35.00 │ 5d ago │
│    +57 302 345 6789              │           │         │        │
└─────────────────────────────────────────────────────────────────┘
```

### Customer Detail Page (`/customers/[id]`)

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back    Maria Garcia                              [Edit] [⋮]  │
│           +57 300 123 4567                                      │
│           ⭐ Gold Customer (32 orders, $450 lifetime)           │
├─────────────────────────────────────────────────────────────────┤
│ [Overview] [Orders] [Conversations] [Preferences] [Notes]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📍 Saved Addresses                                    [+ Add]   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏠 Home (default)                                    [Edit] │ │
│ │    Calle 85 #15-30, Apto 402, Chapinero                     │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 🏢 Work                                              [Edit] │ │
│ │    Carrera 7 #72-41, Oficina 801                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 🧠 Preferences & Restrictions                         [+ Add]   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🚫 ALLERGY: Peanuts                           [AI extracted]│ │
│ │ 🥗 Restriction: Vegetarian                    [AI extracted]│ │
│ │ 🌶️ Preference: Extra spicy                       [Manual]  │ │
│ │ 💵 Behavior: Always pays cash                 [AI extracted]│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 📝 Staff Notes                                        [+ Add]   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ "Friend of owner, always give extra portion" - Juan (2d ago)│ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 📊 Quick Stats                                                  │
│ • First order: Jan 15, 2025                                     │
│ • Last order: Today                                             │
│ • Average order: $14.06                                         │
│ • Most ordered: Hamburguesa Clásica (18x)                       │
│ • Preferred time: Fridays 7-9pm                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Conversation View - Customer Context Panel

Add a collapsible side panel in conversation view showing customer context:

```
┌──────────────────────────────────────┐
│ 👤 Maria Garcia            ⭐ Gold   │
│ +57 300 123 4567                     │
├──────────────────────────────────────┤
│ 📍 Calle 85 #15-30, Chapinero        │
│                                      │
│ 🚫 Allergies: Peanuts                │
│ 🥗 Vegetarian                        │
│ 🌶️ Likes extra spicy                 │
│                                      │
│ 📝 "Friend of owner"                 │
│                                      │
│ 📦 32 orders ($450 total)            │
│ Last: Hamburguesa + Coca (2h ago)    │
├──────────────────────────────────────┤
│ [View Full Profile]                  │
└──────────────────────────────────────┘
```

## Conversation Flow Examples

### Returning Customer with Saved Address

```
Customer: Hola, quiero pedir una pizza

AI: ¡Hola Maria! Qué gusto verte de nuevo 😊
    ¿Tu pizza margarita de siempre?

Customer: Sí, la misma

AI: Perfecto, te agregué:
    • 1x Pizza Margarita - $25.000
    
    ¿Algo más o procedemos?

Customer: Eso es todo

AI: ¡Listo! ¿Te la enviamos a tu dirección de siempre?
    📍 Calle 85 #15-30, Apto 402

Customer: Sí

AI: Perfecto. Total: $30.000 (incluye envío de $5.000)
    ¿Efectivo como siempre?

Customer: Sí

AI: ✅ ¡Pedido confirmado! #ORD-PIZ-004521
    Tu pizza estará en 30-40 minutos.
    ¡Gracias Maria, siempre es un placer! 🙌
```

### VIP Customer with Issue

```
Customer: Oye, mi pedido de ayer llegó frío

AI: Maria, lo siento muchísimo. Como clienta VIP, 
    esto no debería pasar nunca.
    
    Ya marqué el incidente y te ofrezco:
    • Reembolso completo del pedido, O
    • Tu próximo pedido gratis
    
    ¿Qué prefieres? Y de nuevo, mil disculpas 🙏
```

### New Preference Detected

```
Customer: Quiero una hamburguesa pero sin cebolla

AI: ¡Claro! Hamburguesa sin cebolla.
    
    [Internal: Saves preference "no onions" with 0.9 confidence]

[Next order, weeks later]

Customer: Dame una hamburguesa

AI: ¿Tu hamburguesa sin cebolla como siempre?

Customer: Sí, exacto

AI: Perfecto, ya la agregué 👍
```

## Performance Requirements

- Customer lookup by phone: < 50ms
- Context loading: < 100ms  
- Memory search (tool): < 500ms
- Summary generation (async): < 5s
- Fact extraction (async): < 3s
- Total added latency per message: < 150ms

## Success Metrics

- Address reuse rate > 80% (returning customers use saved address)
- Preference recall accuracy > 95%
- Tier-appropriate AI response rate > 90%
- Customer return rate increase (measure vs baseline)
- Average conversation length decrease (less back-and-forth)
- Customer satisfaction (fewer escalations from repeat customers)
- Token efficiency: < 2000 tokens for customer context

## Dependencies

- Feature 01 (Business Onboarding) - business context
- Feature 03 (WhatsApp Integration) - phone number identification
- Feature 04 (AI Conversation Engine) - AI tools integration
- Feature 05 (Order Flow) - order history linkage
- Feature 06 (Conversation Dashboard) - customer context panel

## Security & Privacy

### Data Protection
- Customer data isolated per business (no cross-business queries)
- Phone numbers stored in E.164 format
- Sensitive data (allergies) never logged in plaintext in aiLogs

### LGPD Compliance (Brazil)
- Right to deletion: customer can request "forget me"
- Data portability: export customer data (future)
- Consent: business responsible for customer consent
- Retention: configurable auto-deletion after inactivity period

### Access Control
- Only business owners/staff can view customer data
- Staff-only notes hidden from AI
- Audit log for data access (future)

## Migration Plan

### Phase 1: Schema & Backfill
1. Create new tables (customers, customerAddresses, customerMemory, customerNotes, conversationSummaries)
2. Migrate existing conversations: create customer records from unique `customerId` (phone) values
3. Link existing orders to customer records
4. Backfill `totalOrders` and `totalSpent` from order history

### Phase 2: AI Integration
1. Add customer context loading to AI pipeline
2. Add new AI tools (search_customer_history, save_preference, etc.)
3. Update system prompt generation for VIP handling
4. Test with staging conversations

### Phase 3: Dashboard
1. Customer list page
2. Customer detail page
3. Customer context panel in conversation view
4. Edit capabilities

### Phase 4: Memory Pipeline
1. Implement conversation summary generation
2. Implement fact extraction
3. Enable auto-save of addresses
4. Enable tier auto-calculation

## Open Questions

1. **Tier threshold configurability**: Should every business set their own thresholds, or use sensible defaults?
   - Recommendation: Sensible defaults, optional override in settings

2. **Cross-conversation memory conflicts**: What if customer says "I'm vegetarian" then later "actually I eat chicken"?
   - Recommendation: New fact replaces old with lower confidence, AI asks for confirmation

3. **Memory decay**: Should preferences expire after X months of inactivity?
   - Recommendation: No decay for allergies/restrictions, optional decay for preferences

4. **Multi-device customers**: Same person, different phone numbers?
   - Recommendation: Out of scope for now (each phone = separate customer)

5. **Customer merge**: What if business knows two phones are same person?
   - Recommendation: Future feature - manual merge capability

6. **Summary language**: Generate summaries in business's default language or conversation language?
   - Recommendation: Business's default language (staff reads them)
