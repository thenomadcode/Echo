# PRD-017: Fix AI Conversation Engine & Order Flow

## Overview
Fix critical bugs in the AI conversation engine that prevent orders from being created, customer data from being saved, and Shopify integration from working. Make the AI more sales-oriented with human-like responses.

## Problem Statement
The AI conversation engine has multiple critical failures:
1. **Orders are never created** - Customer provides all information but no order appears in database or Shopify
2. **Customer data lost** - Names, addresses, preferences never saved despite being provided
3. **AI lies to customers** - Says "order placed" when nothing was created
4. **Shopify integration broken** - No draft orders or invoice URLs generated despite Shopify being connected
5. **Unnatural conversation** - AI sends long robotic messages instead of human-like text messages
6. **Passive selling** - AI waits for customer instead of actively driving toward sale

**Real Example**:
```
Customer: "Sure! Ship to: John Smith, 123 Mountain View Dr, Denver, CO 80202. 
          Phone is 555-777-6666. I'll pay cash on delivery."

AI Response: "All set, John! I've placed your order..."

Reality: ❌ No order created, ❌ No address saved, ❌ No name saved, ❌ No Shopify order
```

## Goals
1. **100% order creation reliability** - Every confirmed order must be created in database
2. **Complete customer data capture** - All information customer provides must be saved
3. **Shopify integration working** - Card payments get invoice URLs, cash payments create Shopify orders
4. **Honest AI responses** - Never claim order is placed until it actually is
5. **Sales-focused AI** - Actively guide customers toward purchase completion
6. **Human-like messaging** - Short, conversational responses like real text messages

## Non-Goals (Out of Scope)
- Multi-language prompt optimization (keep existing language support)
- New payment methods beyond card/cash
- Order modification after creation
- Integration with other e-commerce platforms besides Shopify

## User Stories

### Story 1: Order Creation Always Succeeds
**As a** customer
**I want** my order to be created when I provide all required information
**So that** I receive my products and don't have to re-order

**Acceptance Criteria:**
- [ ] When customer provides delivery info + payment method in ONE message, order is created
- [ ] When customer provides info across MULTIPLE messages, order is created after final confirmation
- [ ] Order exists in `orders` table with status "draft" (card) or "confirmed" (cash)
- [ ] Customer receives order number in confirmation message
- [ ] AI never says "order placed" unless order actually exists in database

**Technical Requirements:**
- Support multi-intent detection (detect delivery + payment in single message)
- Add validation layer - verify order exists before sending confirmation
- Add retry logic for failed order creation

### Story 2: Shopify Integration Works for All Payment Types
**As a** business owner with Shopify
**I want** all orders to sync to Shopify automatically
**So that** I can fulfill orders from my Shopify admin panel

**Acceptance Criteria:**
- [ ] **Card payment**: Shopify draft order created, invoice URL sent to customer in WhatsApp
- [ ] **Cash payment**: Shopify order created in background, inventory decremented
- [ ] Customer sees payment link in response message (card only)
- [ ] Shopify order ID saved to Convex order record
- [ ] Inventory in Shopify syncs with Convex

**Technical Requirements:**
- Ensure `orders/payments.ts` generatePaymentLink() is called after order creation
- Ensure `orders/delivery.ts` setPaymentMethod() triggers Shopify order creation for cash
- Add error handling for Shopify API failures
- Log Shopify order creation success/failure

**Test Cases:**
```
Test 1: Card Payment with Shopify
  Customer: "I'll pay by card"
  Expected: Draft order in Shopify + invoice URL sent

Test 2: Cash Payment with Shopify  
  Customer: "Cash on delivery"
  Expected: Confirmed order in Shopify + confirmation sent (no URL)

Test 3: Card Payment without Shopify
  Customer: "I'll pay by card"
  Expected: Stripe checkout session + payment URL sent
```

### Story 3: Customer Name Always Extracted and Saved
**As a** business owner
**I want** customer names to be captured automatically
**So that** I can personalize future interactions and pre-fill Shopify customer data

**Acceptance Criteria:**
- [ ] AI extracts customer name when mentioned in messages (e.g., "Ship to John Smith...")
- [ ] Name saved to `customers.name` field in database
- [ ] AI can use customer name in future messages ("Hi John!")
- [ ] Name passed to Shopify when creating orders

**Technical Requirements:**
- Add name extraction to intent classification OR add new `save_customer_name` tool
- Update `customers.update()` mutation when name is extracted
- Add name to context for AI responses
- Pass name to Shopify draft order creation

**Prompt Addition**:
```
When a customer provides their name (explicitly or in delivery address), 
you MUST extract and save it immediately using the save_customer_name tool.

Examples:
- "Ship to John Smith, 123 Main St" → Extract: "John Smith"
- "My name is Sarah" → Extract: "Sarah"  
- "This is for Maria Garcia" → Extract: "Maria Garcia"
```

### Story 4: Customer Address Persisted to Database
**As a** returning customer
**I want** my delivery address to be remembered
**So that** I don't have to re-type it for every order

**Acceptance Criteria:**
- [ ] First-time address provided → Saved to `customerAddresses` table with label "Home"
- [ ] Address marked as default for customer
- [ ] Future orders can use "use my saved address"
- [ ] Address shown in customer profile in dashboard
- [ ] Fuzzy matching prevents duplicate addresses

**Technical Requirements:**
- Intent-based flow must call `save_customer_address` (currently only in tool-based flow)
- Add address extraction from delivery intent
- Call `api.ai.customerHistory.updateCustomerAddress` after delivery info collected
- Ensure address persists even if order creation fails

**Code Changes**:
```typescript
// In handleCheckoutIntent (process.ts)
if (intent.type === "delivery_choice" && intent.address) {
  // Save address to database, not just pendingDelivery
  await ctx.runAction(api.ai.customerHistory.updateCustomerAddress, {
    customerId: conversation.customerRecordId,
    address: intent.address,
    label: "Home",
    setAsDefault: true,
  });
}
```

### Story 5: Customer Preferences and Notes Captured
**As a** business owner
**I want** customer preferences and conversation notes to be saved
**So that** I can provide personalized service

**Acceptance Criteria:**
- [ ] AI detects customer preferences (e.g., "I don't like spicy food", "I prefer delivery in the morning")
- [ ] Preferences saved to `customerMemory` with category and fact
- [ ] Conversation summary created after order completion
- [ ] Business-relevant notes saved (e.g., "Allergic to nuts", "VIP customer")

**Technical Requirements:**
- Enable `save_customer_preference` tool in intent-based flow
- Add conversation summary generation after state = "completed"
- Store summaries in `conversationSummaries` table

**Prompt Addition**:
```
Pay attention to customer preferences and important information:
- Dietary restrictions → Save as "restriction"
- Product preferences → Save as "preference"  
- Behavioral patterns → Save as "behavior"
- Allergies → Save as "allergy"

Use the save_customer_preference tool immediately when you detect these.
```

### Story 6: Multi-Intent Detection in Single Message
**As a** customer
**I want** to provide multiple pieces of information in one message
**So that** I can complete my order faster

**Acceptance Criteria:**
- [ ] "Deliver to 123 Main St and I'll pay cash" → Detects delivery + payment intents
- [ ] "My name is John, deliver to 456 Oak Ave, I'll pay by card" → Detects name + delivery + payment
- [ ] Order created immediately if all required info is present
- [ ] State machine progresses multiple steps in single message

**Technical Requirements:**
- Update `ai/intent.ts` to return array of intents instead of single intent
- Update `determineNewState()` to process multiple intents in sequence
- Update `handleCheckoutIntent()` to handle multiple intents in one message

**Code Changes**:
```typescript
// In intent.ts
export type IntentResult = {
  intents: Intent[];  // Changed from single intent
  tokensUsed: number;
};

// In process.ts
const intentResult = await ctx.runAction(api.ai.intent.classifyIntent, {...});
for (const intent of intentResult.intents) {
  newState = determineNewState(intent, newState);
  orderUpdate = handleOrderIntent(intent, ...);
  checkoutResult = await handleCheckoutIntent(intent, ...);
}
```

### Story 7: AI is Sales-Focused and Directive
**As a** business owner
**I want** the AI to actively guide customers toward completing purchases
**So that** I don't lose sales to abandoned conversations

**Acceptance Criteria:**
- [ ] AI proactively asks for missing information to complete order
- [ ] AI encourages purchase when customer is browsing ("Would you like to order this?")
- [ ] AI suggests upsells/cross-sells when appropriate
- [ ] AI uses urgency when relevant ("Only 3 left in stock!")
- [ ] AI's primary objective is closing the sale, not just answering questions

**Prompt Changes**:
```markdown
# YOUR CORE OBJECTIVE: SELL

Your primary goal is to help customers complete purchases. Every interaction should move toward:
1. Adding products to their order
2. Collecting delivery information  
3. Processing payment
4. Confirming the order

## Sales Directives

### When customer is browsing:
✅ "That's $X.XX. Want me to add it to your order?"
✅ "Ready to order? I can get this delivered to you today"
❌ "Let me know if you have any questions" (too passive)

### When customer is hesitating:
✅ "Only 2 left in stock - should I reserve one for you?"
✅ "Most customers love this one. Want to try it?"
❌ "Take your time deciding" (loses urgency)

### When cart has items:
✅ "You have 1 item ready to go. Delivery or pickup?"
✅ "Let's get this ordered - where should I send it?"
❌ "Anything else?" (suggests they should buy more before proceeding)

### When delivery info is collected:
✅ "Perfect! Cash or card?"
✅ "Great address. How would you like to pay?"
❌ "Is there anything else you'd like to know?" (delays completion)

## Mandatory Order Creation

When customer has:
- ✅ Items in cart
- ✅ Delivery preference set
- ✅ Payment method chosen

You MUST:
1. Use submit_order tool immediately
2. Verify order was created successfully
3. Only then send confirmation with order number
4. NEVER say "order placed" if submit_order failed
```

### Story 8: AI Responds Like a Human Texting
**As a** customer  
**I want** natural, conversational responses
**So that** messaging feels like talking to a real person, not a robot

**Acceptance Criteria:**
- [ ] Messages are 1-2 sentences max (like real text messages)
- [ ] No long product lists (max 2-3 products mentioned at once)
- [ ] Uses casual language ("Hey!" not "Hello, valued customer")
- [ ] Uses emojis sparingly and naturally
- [ ] Asks one question at a time
- [ ] No bullet points or formatted lists in messages

**Prompt Changes**:
```markdown
# Communication Style: Text Like a Human

You are texting customers on WhatsApp. Write like a real person texting, not a customer service robot.

## DO:
✅ "Hey! We've got 3 snowboards around $750. Want to see them?"
✅ "Cool! That one's $749. Should I add it?"
✅ "Where should I send it?"

## DON'T:
❌ "Hello! I'd be happy to assist you today. We have several premium snowboard options..."
❌ "Here are our available products:
    - Product A - $X.XX
    - Product B - $X.XX  
    - Product C - $X.XX
    Please let me know which interests you."
❌ "Thank you for your inquiry. To better assist you, could you please provide..."

## Length Rules:
- 1-2 sentences per message MAX
- If you need to share multiple products, mention 2-3 max, then ask which they prefer
- Save long explanations for when customer specifically asks

## Tone:
- Casual and friendly (like texting a helpful friend)
- Use contractions ("I'll" not "I will", "you're" not "you are")
- Okay to use "yeah", "cool", "awesome", "got it"
- No corporate speak or formal language
```

**Example Transformation**:

❌ **OLD (Robotic)**:
```
Great! Here's what I have for your cart:

- The Complete Snowboard — $699.95
- The Multi-location Snowboard — $729.95  
- The Videographer Snowboard — $885.95

Grand total: $2,315.85

The Videographer is above your $700-$800 budget. Would you like me to swap that for:
- The Collection Snowboard: Liquid — $749.95
- The Compare at Price Snowboard — $785.95

If you're happy with the three as-is, I can place the order. What board length do you want?
```

✅ **NEW (Human)**:
```
Just added all 3 to your cart. Total is $2,315 though - the Videographer is $885 which is over your budget.

Want me to swap it for something closer to $750?
```

### Story 9: Order Validation Before Confirmation
**As a** customer
**I want** accurate information about my order status
**So that** I know exactly what to expect

**Acceptance Criteria:**
- [ ] AI never says "order placed" unless order ID exists
- [ ] AI re-checks database before sending confirmation
- [ ] If order creation fails, AI says "Had trouble creating order, let me try again"
- [ ] Confirmation message includes actual order number from database

**Technical Requirements**:
- Add validation in response generation: check order exists before mentioning it
- Add error handling in order creation flow
- Return order creation status to AI in checkoutResult

**Code Changes**:
```typescript
// In handleCheckoutIntent
if (intent.type === "payment_choice") {
  try {
    const orderId = await ctx.runMutation(api.orders.mutations.create, {...});
    
    // Verify order was actually created
    const orderExists = await ctx.runQuery(api.orders.queries.get, { orderId });
    if (!orderExists) {
      return { error: "Order creation failed - order not found after creation" };
    }
    
    return {
      orderId,
      orderNumber: orderExists.orderNumber,
      success: true,
    };
  } catch (error) {
    return { 
      error: error.message,
      success: false,
    };
  }
}
```

**Prompt Addition**:
```
CRITICAL: Order Confirmation Rules

ONLY say "order placed" or "order confirmed" if:
1. submit_order tool returned success=true
2. You received an actual order number

If submit_order failed or returned an error:
- "Had trouble creating your order. Let me try again."
- DO NOT pretend the order was created
- DO NOT give fake order numbers
```

## Technical Architecture

### Current System (Broken)
```
WhatsApp Message
  ↓
processAndRespond (intent-based)
  ↓
classifyIntent (returns SINGLE intent)
  ↓
determineNewState (processes single intent)
  ↓
handleCheckoutIntent (only creates order if state=payment AND intent=payment_choice)
  ↓
❌ Customer provides delivery + payment in ONE message
❌ Only delivery intent detected
❌ State moves to "payment" but waits for ANOTHER message
❌ Order never created
```

### New System (Fixed)
```
WhatsApp Message
  ↓
processAndRespond (enhanced)
  ↓
classifyIntent (returns ARRAY of intents)
  ↓
For each intent:
  ↓
  determineNewState
  ↓
  handleOrderIntent (update cart)
  ↓
  handleCheckoutIntent (create order if conditions met)
  ↓
  handleCustomerData (save name, address, preferences)
  ↓
✅ All intents processed in sequence
✅ Order created if all info present
✅ Customer data persisted
✅ Shopify integration triggered
```

### Data Flow

```
Customer provides info
  ↓
Intent Detection (multi-intent)
  ├─ delivery_choice → Save address to customerAddresses
  ├─ name_provided → Save to customers.name  
  ├─ payment_choice → Create order
  └─ preference_mentioned → Save to customerMemory
  ↓
Order Created (if conditions met)
  ├─ Insert to orders table
  ├─ Set delivery info
  ├─ Set payment method
  ├─ IF Shopify connected:
  │   ├─ Card → Create draft order + invoice URL
  │   └─ Cash → Create order (background)
  └─ Return order number
  ↓
Validate Order Exists
  ↓
Send Confirmation to Customer
  ├─ Order number
  ├─ Payment link (if card)
  └─ Delivery details
```

## Data Model Changes

### customers table
```typescript
// BEFORE
{
  phone: "+15557776666",
  name: null,  // ❌ Never set
}

// AFTER  
{
  phone: "+15557776666",
  name: "John Smith",  // ✅ Extracted from message
}
```

### customerAddresses table
```typescript
// BEFORE
[]  // ❌ Empty - nothing saved

// AFTER
[
  {
    customerId: "kx7d...",
    address: "123 Mountain View Dr, Denver, CO 80202",
    label: "Home",
    isDefault: true,
    createdAt: 1769883461081,
  }
]
```

### conversations table
```typescript
// BEFORE
{
  state: "confirming",
  pendingOrder: { items: [...], total: 74995 },
  pendingDelivery: null,  // ❌ Not saved
}

// AFTER
{
  state: "completed",  // ✅ Progressed to completion
  pendingOrder: null,  // ✅ Cleared after order creation
  pendingDelivery: null,  // ✅ Cleared after order creation
}
```

### orders table
```typescript
// BEFORE
[]  // ❌ Empty - no order created

// AFTER
[
  {
    orderNumber: "ORD-12345",
    status: "confirmed",  // cash payment
    items: [{ productId: "...", quantity: 1, ... }],
    deliveryAddress: "123 Mountain View Dr, Denver, CO 80202",
    contactName: "John Smith",  // ✅ Name included
    contactPhone: "+15557776666",
    paymentMethod: "cash",
    paymentProvider: "cash",
    shopifyOrderId: "gid://shopify/Order/...",  // ✅ Shopify synced
    createdAt: 1769883461081,
  }
]
```

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `ai/intent.ts` | Return array of intents instead of single intent | P0 |
| `ai/process.ts` | Process multiple intents per message | P0 |
| `ai/process.ts` | Add customer data persistence after intent detection | P0 |
| `ai/process.ts` | Add order validation before confirmation | P0 |
| `ai/prompts.ts` | Make AI sales-focused and directive | P0 |
| `ai/agentPrompt.ts` | Add human-like messaging style rules | P0 |
| `ai/agentPrompt.ts` | Add mandatory order creation rules | P0 |
| `ai/tools.ts` | Add `save_customer_name` tool | P1 |
| `ai/agent.ts` | Add `executeSaveCustomerName` function | P1 |
| `orders/payments.ts` | Add detailed logging for Shopify integration | P1 |
| `orders/delivery.ts` | Verify Shopify order creation for cash payments | P1 |

## Success Metrics

### Order Creation Rate
- **Current**: ~0% (orders not created despite AI saying they were)
- **Target**: 100% (every confirmed order creates database record)

### Customer Data Completeness
- **Current**: ~20% (only phone number saved)
- **Target**: 95% (name, phone, address saved when provided)

### Shopify Sync Rate
- **Current**: 0% (no orders syncing to Shopify)
- **Target**: 100% (all orders sync with correct payment type)

### Conversation Completion Rate
- **Current**: ~30% (customers abandon when flow breaks)
- **Target**: 80% (smooth flow from browse → order → payment)

### AI Response Quality
- **Metric**: Average message length
- **Current**: ~150 characters (too long, robotic)
- **Target**: 60-80 characters (human-like texting)

### Time to Order Completion
- **Current**: 8-10 messages (broken flow, re-collecting info)
- **Target**: 4-6 messages (browse → add → deliver → pay → confirm)

## Implementation Phases

### Phase 1: Critical Bugs (Week 1)
- [ ] Multi-intent detection
- [ ] Order creation reliability
- [ ] Shopify integration working
- [ ] Order validation before confirmation

**Why First**: Customers are literally losing orders right now

### Phase 2: Customer Data (Week 2)  
- [ ] Name extraction and saving
- [ ] Address persistence to database
- [ ] Preferences and notes capture
- [ ] Conversation summaries

**Why Second**: Improves customer experience and retention

### Phase 3: AI Personality (Week 3)
- [ ] Sales-focused prompts
- [ ] Human-like messaging style
- [ ] Directive conversation flow
- [ ] Reduced message length

**Why Third**: Makes AI more effective at selling

## Testing Strategy

### End-to-End Test Cases

**Test 1: Single Message Order Completion**
```
Customer: "I want 1 snowboard delivered to 123 Main St, I'll pay cash"
Expected:
  ✅ Order created with status "confirmed"
  ✅ Address saved to customerAddresses  
  ✅ Shopify order created (background)
  ✅ Confirmation sent with order number
  ✅ No payment link (cash payment)
```

**Test 2: Card Payment with Shopify**
```
Customer: "Add The Collection Snowboard: Liquid to cart"
AI: "Added! That's $749.95. Delivery or pickup?"
Customer: "Delivery to 456 Oak Ave"  
AI: "Got it. Cash or card?"
Customer: "Card"
Expected:
  ✅ Shopify draft order created
  ✅ Invoice URL sent in response
  ✅ Order status = "draft"
  ✅ Payment link expires in 24h
```

**Test 3: Name Extraction**
```
Customer: "Hi, I'm Sarah. I want to order 2 lattes"
Expected:
  ✅ customers.name = "Sarah"
  ✅ AI uses name in future messages: "Hi Sarah!"
```

**Test 4: Multi-Message Flow**
```
Customer: "I want a snowboard"
AI: "Cool! What's your budget?"
Customer: "Around $700-800"
AI: "Got 2 options: The Liquid ($750) or The Hidden ($750). Which one?"
Customer: "The Liquid"
AI: "Nice! Added it. Where should I send it?"
Customer: "123 Main St, Denver CO"
AI: "Perfect! Cash or card?"
Customer: "Cash"
Expected:
  ✅ Order created after final message
  ✅ Address saved
  ✅ Total conversation: 7 messages (reasonable)
```

**Test 5: AI Sales Effectiveness**
```
Customer: "Tell me about your snowboards"
AI Response Quality Check:
  ✅ Length < 100 characters
  ✅ Mentions max 2-3 products
  ✅ Ends with question pushing toward purchase
  ✅ Uses casual language
  ❌ No bullet points or formatted lists
```

## Edge Cases

### Order Creation Fails
```
Scenario: Shopify API returns 500 error
Expected:
  ✅ AI: "Having trouble creating your Shopify order. Let me try again."
  ✅ Retry mechanism triggers
  ✅ Fallback: Create Convex order anyway, sync Shopify later
  ❌ AI does NOT say "order placed"
```

### Customer Provides Incomplete Address
```
Scenario: "Deliver to Main St"
Expected:
  ✅ AI: "I need the full address - street number, city, and zip code?"
  ✅ State stays in "confirming" until complete address provided
  ❌ Does not create order with incomplete address
```

### Inventory Out of Stock
```
Scenario: Customer orders product with 0 inventory
Expected:
  ✅ AI: "Sorry, that one's out of stock right now. Want me to suggest something similar?"
  ❌ Does not add out-of-stock item to cart
```

### Customer Changes Mind
```
Scenario: Customer says "Actually, cancel that" after order created
Expected:
  ✅ AI: "No problem! Order cancelled. Want to start over?"
  ✅ Order status changed to "cancelled"  
  ✅ Inventory returned to stock
```

## Security & Privacy

### Customer Data Protection
- [ ] Customer addresses encrypted at rest
- [ ] Payment links expire after 24 hours
- [ ] Customer can request data deletion (existing feature)
- [ ] No credit card details stored (handled by Shopify/Stripe)

### Shopify API Security
- [ ] Access tokens stored in encrypted environment variables
- [ ] API calls use HTTPS only
- [ ] Rate limiting respected (max 2 req/sec)
- [ ] Failed auth triggers alert to business owner

## Documentation Updates

### For Developers
- [ ] Update `AGENTS.md` with new AI flow architecture
- [ ] Document multi-intent detection in code comments
- [ ] Add examples of customer data persistence flow
- [ ] Update Shopify integration section

### For Business Owners
- [ ] Help doc: "How the AI closes sales"
- [ ] FAQ: "Why do I need Shopify connected?"
- [ ] Tutorial: "Reviewing customer profiles"

## Rollout Plan

### 1. Development (Week 1-3)
- Implement changes in feature branch
- Write comprehensive tests
- Test on staging environment

### 2. Beta Testing (Week 4)
- Deploy to 3-5 pilot businesses  
- Monitor order creation rate
- Collect feedback on AI personality

### 3. Gradual Rollout (Week 5-6)
- Deploy to 25% of businesses
- Monitor Shopify sync errors
- Deploy to 50% if metrics look good
- Full deployment if all metrics hit targets

### 4. Monitoring
- Daily dashboard: Order creation rate, Shopify sync rate
- Weekly review: Customer data completeness
- Alert if order creation rate drops below 95%

## Open Questions

1. **Should AI proactively upsell?**
   - "Want fries with that?" approach
   - Risk: annoying vs. increasing average order value
   - Recommendation: A/B test with 50% of customers

2. **How aggressive should sales prompts be?**
   - Pushy: "Let's get this ordered now"
   - Gentle: "Ready whenever you are"
   - Recommendation: Start gentle, adjust based on conversion rates

3. **What if customer goes silent mid-order?**
   - Send reminder after 30 min?
   - Save cart for 24h?
   - Recommendation: Save cart, send gentle reminder after 1h

4. **Should we support voice messages?**
   - Currently only text/images
   - Voice would need transcription
   - Recommendation: Phase 4 feature, not in this PRD

## Dependencies

- OpenAI API (for intent classification and response generation)
- Shopify API (for order sync)
- Convex backend (database and mutations)
- WhatsApp Business API (message delivery)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multi-intent breaks existing flows | High | Extensive testing, feature flag rollout |
| Shopify API rate limits | Medium | Implement queue for order creation, exponential backoff |
| Customer data privacy concerns | High | Encrypt sensitive data, clear privacy policy |
| AI becomes too pushy | Medium | A/B test different prompt aggressiveness levels |
| Performance degradation | Medium | Profile intent detection speed, optimize if >3s |

## Definition of Done

- [ ] All P0 files modified with tests passing
- [ ] 100% order creation rate in staging environment
- [ ] Shopify integration verified with real test store
- [ ] Customer data (name, address) persisting correctly
- [ ] AI responses average <100 characters
- [ ] End-to-end test: Browse → Order → Shopify sync in <2 minutes
- [ ] Code reviewed by 2 team members
- [ ] Deployed to beta businesses successfully
- [ ] Monitoring dashboard showing green metrics for 48h

---

**Created**: 2026-01-31
**Author**: Product Team
**Status**: Draft - Awaiting Technical Review
**Estimated Effort**: 2-3 weeks
**Priority**: P0 - Critical (Revenue Blocking)
