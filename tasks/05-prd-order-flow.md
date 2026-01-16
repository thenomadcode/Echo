# 05 - Order Flow - Product Requirements Document

## Overview
The complete flow from customer expressing order intent to order confirmation and payment. This connects the AI conversation to actual order creation and payment collection.

## Problem Statement
When a customer says "I want to order X", the AI needs to:
1. Understand what they want to order
2. Confirm items and quantities
3. Collect delivery information
4. Create the order
5. Collect payment (link or cash on delivery)
6. Confirm everything

This is the core value proposition - turning chat into sales.

## Goals
- Smooth conversational order flow (not form-like)
- Support multiple items per order
- Support delivery and pickup
- Support payment link and cash on delivery
- Handle order modifications mid-flow
- Clear confirmation before finalizing
- Order stored in Echo (sync to Shopify later if integrated)

## Non-Goals (Out of Scope)
- Payment processing (we send links, external processor handles payment)
- Order fulfillment / kitchen display (business handles this)
- Delivery tracking (later)
- Tipping (later)
- Promo codes / discounts (later)
- Scheduled orders / future delivery (later)

## User Stories

### Story 1: Start Order
**As a** customer  
**I want** to start an order naturally  
**So that** I can get what I need

**Acceptance Criteria:**
- [ ] "Quiero pedir una hamburguesa" → Starts order, adds item
- [ ] "Me das 2 pizzas grandes" → Starts order with quantity
- [ ] AI confirms what was understood
- [ ] AI asks if they want anything else
- [ ] Handles partial product matches ("la hamburguesa con queso" → finds best match)

### Story 2: Add Items
**As a** customer  
**I want** to add more items to my order  
**So that** I can order everything at once

**Acceptance Criteria:**
- [ ] "También quiero una coca" → Adds to existing order
- [ ] "Agrega otra hamburguesa" → Adds same item again
- [ ] "Y 3 empanadas" → Adds with quantity
- [ ] AI shows running total after each addition
- [ ] Handles unavailable products gracefully (suggests alternatives)

### Story 3: Modify Order
**As a** customer  
**I want** to change my order before confirming  
**So that** I get exactly what I want

**Acceptance Criteria:**
- [ ] "Quita la coca" → Removes item
- [ ] "Cambia la hamburguesa por pizza" → Replaces item
- [ ] "Mejor que sean 3 empanadas, no 2" → Updates quantity
- [ ] "Empezar de nuevo" → Clears order
- [ ] AI confirms changes and shows updated total

### Story 4: Review Order
**As a** customer  
**I want** to see my complete order  
**So that** I can verify before paying

**Acceptance Criteria:**
- [ ] "¿Qué llevo?" → Shows order summary
- [ ] Summary includes: items, quantities, individual prices, total
- [ ] AI asks if order is complete or if they want to add more
- [ ] Clear formatting (easy to read on mobile)

### Story 5: Collect Delivery Info
**As a** customer  
**I want** to provide delivery details  
**So that** I receive my order

**Acceptance Criteria:**
- [ ] AI asks: "¿Para domicilio o para recoger?"
- [ ] If delivery: asks for address
- [ ] If pickup: confirms location and estimated time
- [ ] Validates address is in delivery zone (if zones configured)
- [ ] Asks for contact phone if different from WhatsApp
- [ ] Asks for delivery notes (apartment #, gate code, etc.)

### Story 6: Payment Options
**As a** customer  
**I want** to choose how to pay  
**So that** I can use my preferred method

**Acceptance Criteria:**
- [ ] AI asks: "¿Cómo deseas pagar? Tarjeta o efectivo"
- [ ] Card: generates payment link, sends to customer
- [ ] Cash on delivery: confirms, notes on order
- [ ] If card selected, AI waits for payment confirmation
- [ ] Handles payment link expiration (re-send if needed)

### Story 7: Payment Confirmation
**As a** customer who paid online  
**I want** confirmation that payment was received  
**So that** I know my order is being prepared

**Acceptance Criteria:**
- [ ] Webhook receives payment confirmation from payment provider
- [ ] Order status updates to "paid"
- [ ] AI sends confirmation message with order number
- [ ] AI provides estimated delivery/pickup time
- [ ] If payment fails, AI notifies and offers to retry or switch to cash

### Story 8: Order Confirmation (Cash)
**As a** customer paying cash  
**I want** confirmation that my order was received  
**So that** I know it's being prepared

**Acceptance Criteria:**
- [ ] Order created with status "confirmed" (not paid)
- [ ] AI sends confirmation with order number
- [ ] AI confirms amount to pay on delivery
- [ ] AI provides estimated delivery/pickup time

### Story 9: Cancel Order
**As a** customer  
**I want** to cancel my order  
**So that** I'm not charged for something I don't want

**Acceptance Criteria:**
- [ ] "Cancelar pedido" → Cancels if not yet paid
- [ ] If paid: escalates to human for refund
- [ ] If in preparation: notifies may not be possible, escalates
- [ ] Clear confirmation of cancellation

## Technical Requirements

### Order State Machine
```
NONE → COLLECTING_ITEMS → COLLECTING_DELIVERY → COLLECTING_PAYMENT → AWAITING_PAYMENT → CONFIRMED → (business fulfills)
                                                      ↓
                                              CONFIRMED (cash)
```

### Payment Integration
For MVP, integrate with **one** payment provider. Recommend **Stripe** for simplicity, or **Mercado Pago** for LATAM.

```typescript
// Generate payment link
const paymentLink = await stripe.paymentLinks.create({
  line_items: order.items.map(item => ({
    price_data: {
      currency: order.currency,
      product_data: { name: item.name },
      unit_amount: item.price,
    },
    quantity: item.quantity,
  })),
  metadata: { orderId: order._id },
});
```

### Webhook for Payment
```typescript
// packages/backend/convex/http.ts
http.route({
  path: "/webhook/stripe",
  method: "POST",
  handler: stripeWebhookHandler,
});

// Handle checkout.session.completed event
// Update order status to "paid"
// Trigger confirmation message via WhatsApp
```

### Environment Variables
```bash
PAYMENT_PROVIDER=stripe  # or "mercadopago"
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx
MERCADOPAGO_ACCESS_TOKEN=xxx
```

### API Endpoints (Convex Functions)

```typescript
// Order mutations
orders.create({ businessId, conversationId, items, deliveryType, deliveryAddress? })
orders.addItem({ orderId, productId, quantity })
orders.removeItem({ orderId, productId })
orders.updateItemQuantity({ orderId, productId, quantity })
orders.setDeliveryInfo({ orderId, type, address?, notes?, contactPhone? })
orders.setPaymentMethod({ orderId, method: "card" | "cash" })
orders.cancel({ orderId, reason? })

// Order actions (external calls)
orders.generatePaymentLink({ orderId })
orders.processPaymentWebhook({ payload, signature })

// Order queries
orders.get({ orderId })
orders.getByConversation({ conversationId })
orders.listByBusiness({ businessId, status?, limit?, cursor? })
```

## Data Model

### `orders` table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| businessId | Id<"businesses"> | yes | Parent business |
| conversationId | Id<"conversations"> | yes | Source conversation |
| orderNumber | string | yes | Human-readable order # (e.g., "ORD-001234") |
| status | string | yes | "draft" \| "confirmed" \| "paid" \| "preparing" \| "ready" \| "delivered" \| "cancelled" |
| items | array | yes | [{ productId, name, quantity, unitPrice, totalPrice }] |
| subtotal | number | yes | Sum of items (in smallest currency unit) |
| deliveryFee | number | no | Delivery charge |
| total | number | yes | subtotal + deliveryFee |
| currency | string | yes | "COP" \| "BRL" \| "MXN" etc |
| deliveryType | string | yes | "delivery" \| "pickup" |
| deliveryAddress | string | no | Full address |
| deliveryNotes | string | no | Special instructions |
| contactPhone | string | yes | Customer phone |
| contactName | string | no | Customer name |
| paymentMethod | string | yes | "card" \| "cash" |
| paymentStatus | string | yes | "pending" \| "paid" \| "failed" \| "refunded" |
| paymentLinkUrl | string | no | Generated payment link |
| paymentLinkExpiresAt | number | no | Expiration timestamp |
| stripeSessionId | string | no | For payment reconciliation |
| estimatedReadyTime | number | no | Timestamp |
| notes | string | no | Internal notes |
| createdAt | number | yes | Timestamp |
| updatedAt | number | yes | Timestamp |
| cancelledAt | number | no | If cancelled |
| cancellationReason | string | no | Why cancelled |

### Indexes
- `orders.by_business`: [businessId, status, createdAt]
- `orders.by_conversation`: [conversationId]
- `orders.by_number`: [orderNumber] - lookup by order number
- `orders.by_payment_session`: [stripeSessionId] - for webhook lookup

### Order Number Generation
Sequential per business: `ORD-{business_prefix}-{sequential_number}`
E.g., "ORD-BUR-001234" for "Burger Place"

## UI/UX

### Conversation Flow Example
```
Customer: Quiero 2 hamburguesas clásicas y una coca

AI: Perfecto, te agregué:
    • 2x Hamburguesa Clásica - $16.000
    • 1x Coca-Cola - $3.000
    
    Total: $19.000
    
    ¿Algo más o procedemos con el pedido?

Customer: Eso es todo

AI: ¡Listo! ¿Es para domicilio o pasas a recoger?

Customer: Domicilio

AI: ¿A qué dirección te lo enviamos?

Customer: Calle 85 #15-30, apto 402

AI: Perfecto, Calle 85 #15-30, Apto 402.
    El envío tiene un costo de $5.000.
    
    Total con envío: $24.000
    
    ¿Cómo deseas pagar? ¿Tarjeta o efectivo?

Customer: Tarjeta

AI: Aquí tienes el link de pago seguro:
    🔗 https://pay.stripe.com/xxx
    
    Te confirmo apenas recibamos el pago.

[Payment webhook received]

AI: ✅ ¡Pago recibido!
    
    Tu pedido #ORD-BUR-001234 está confirmado.
    Tiempo estimado de entrega: 35-45 minutos.
    
    ¡Gracias por tu compra! 🙌
```

### Dashboard - Order List
- `/orders` - List all orders
- Filterable by status, date
- Quick actions: mark as preparing, ready, delivered
- Click to see full order details + conversation

### Dashboard - Order Detail
- `/orders/[id]` - Order detail view
- Show all order info
- Link to conversation
- Status update buttons
- Print receipt option

## Success Metrics
- Order completion rate > 70% (started → confirmed)
- Payment success rate > 95%
- Average order time < 5 minutes
- Order errors < 1%

## Dependencies
- Feature 02 (Product CMS) - product data
- Feature 03 (WhatsApp Integration) - message send/receive
- Feature 04 (AI Engine) - conversation handling
- Stripe/Mercado Pago account (business sets up)

## Security Considerations
- Verify payment webhook signatures
- Don't expose order details to wrong conversation
- Validate prices server-side (don't trust client)
- Rate limit order creation per conversation

## Open Questions
- Minimum order amount?
- Order confirmation timeout (if customer goes silent)?
- How to handle partial payments?
- Should we support order scheduling (future delivery)?
