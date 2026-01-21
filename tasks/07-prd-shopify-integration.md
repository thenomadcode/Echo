# 07 - Shopify Integration (Admin API) - Product Requirements Document

## Overview
Connect Echo to Shopify stores via Admin API to sync products and process payments through Shopify's checkout. Businesses with existing Shopify stores can use their existing payment methods and see all orders in one place.

## Problem Statement
Many Echo target customers (small LATAM businesses) already use Shopify:
1. They have products in Shopify - re-entering in Echo is wasteful
2. They have Shopify Payments configured - setting up Stripe separately is friction
3. They want orders in Shopify - that's where they manage fulfillment

Current Echo requires Stripe for payments. Shopify merchants would prefer:
- Products auto-synced from Shopify
- Payments through their existing Shopify checkout
- Orders appearing in Shopify admin alongside their web orders

## Goals
- One-click Shopify OAuth connection
- Import all products from Shopify automatically
- Real-time sync when products change in Shopify
- **Create Draft Orders in Shopify for WhatsApp payments** (key differentiator)
- Support both Shopify Payments AND Stripe (fallback for non-Shopify users)
- Orders visible in Shopify admin for unified fulfillment

## Non-Goals (Out of Scope)
- Storefront API / custom checkout UI (not needed for chat commerce)
- Two-way product sync (Echo doesn't modify Shopify products)
- Shopify POS integration
- Shopify themes or storefront modifications
- Multi-location inventory management
- Shopify discount code creation (read-only support OK)

## User Stories

### Story 1: Connect Shopify Store
**As a** business owner with a Shopify store
**I want** to connect my store to Echo
**So that** my products and payments are integrated

**Acceptance Criteria:**
- [ ] Settings page shows "Connect Shopify" button
- [ ] Clicking initiates OAuth flow to Shopify
- [ ] OAuth requests only necessary scopes: `read_products`, `write_draft_orders`, `read_orders`
- [ ] After authorization, redirect back to Echo with success message
- [ ] Connection status clearly shown (Connected / Not Connected)
- [ ] Store name and URL displayed when connected
- [ ] Can disconnect at any time

### Story 2: Initial Product Import
**As a** business owner who just connected Shopify
**I want** to import all my products
**So that** Echo AI can help customers order them

**Acceptance Criteria:**
- [ ] "Import Products" button appears after connection
- [ ] Progress indicator during import (X of Y products)
- [ ] Imports: title, description, price, images, variants, availability
- [ ] Each Shopify variant becomes a separate Echo product (simple approach)
- [ ] Skips draft and archived products
- [ ] Products marked with `source: "shopify"` in Echo
- [ ] Import summary shown: "Imported X products, skipped Y"
- [ ] Handles stores with 1000+ products (paginated API calls)

### Story 3: Real-time Product Sync
**As a** business owner
**I want** Shopify product changes to sync to Echo automatically
**So that** customers always see accurate info

**Acceptance Criteria:**
- [ ] Register Shopify webhooks on connection: `products/create`, `products/update`, `products/delete`
- [ ] New products in Shopify appear in Echo within 1 minute
- [ ] Price changes sync within 1 minute
- [ ] Availability changes sync within 1 minute
- [ ] Deleted products marked as `deleted: true` in Echo (soft delete)
- [ ] Webhook signature verified (HMAC)
- [ ] Sync status and last sync time visible in settings

### Story 4: Manual Resync
**As a** business owner
**I want** to manually trigger a full resync
**So that** I can fix any sync issues

**Acceptance Criteria:**
- [ ] "Sync Now" button in Shopify settings
- [ ] Shows last successful sync timestamp
- [ ] Progress indicator during sync
- [ ] Summary: "Updated X, Added Y, Removed Z"
- [ ] Does not duplicate products (matches by `shopifyProductId`)

### Story 5: Create Draft Order for Payment
**As the** Echo system
**I want** to create a Shopify Draft Order when customer confirms order
**So that** they can pay through Shopify's checkout

**Acceptance Criteria:**
- [ ] When AI confirms order AND business has Shopify connected:
  - [ ] Create Draft Order via Shopify Admin API
  - [ ] Include line items with correct variant IDs
  - [ ] Include customer phone number
  - [ ] Include delivery address (if delivery)
- [ ] Retrieve `invoice_url` from Draft Order response
- [ ] Send `invoice_url` to customer via WhatsApp as payment link
- [ ] Store `shopifyDraftOrderId` on Echo order
- [ ] Draft Order visible in Shopify Admin immediately

### Story 6: Handle Shopify Payment Completion
**As the** Echo system
**I want** to know when a Shopify Draft Order is paid
**So that** I can confirm the order to the customer

**Acceptance Criteria:**
- [ ] Register webhook: `orders/paid`
- [ ] When payment completes, Shopify converts Draft Order to Order
- [ ] Webhook triggers Echo order status update to "paid"
- [ ] AI sends confirmation message via WhatsApp with order number
- [ ] `shopifyOrderId` and `shopifyOrderNumber` stored on Echo order
- [ ] Handle partial payments gracefully (if applicable)

### Story 7: Payment Method Routing
**As the** Echo system
**I want** to route payments to the appropriate provider
**So that** each business uses their preferred payment method

**Acceptance Criteria:**
- [ ] If business has Shopify connected → use Shopify Draft Orders
- [ ] If business has Stripe configured (no Shopify) → use Stripe Checkout
- [ ] If neither configured → show error, prompt to set up payments
- [ ] Cash on delivery always works regardless of payment provider
- [ ] Payment provider choice transparent to customer (just receives a link)

### Story 8: Handle Variants in Chat
**As a** customer ordering a product with variants
**I want** the AI to ask which variant I want
**So that** I get the right product

**Acceptance Criteria:**
- [ ] When product has variants (size, color), AI asks clarifying question
- [ ] AI presents options: "Which size? Small ($10), Medium ($12), Large ($14)"
- [ ] Customer's choice maps to correct Shopify variant ID
- [ ] Correct variant price used in order total
- [ ] Draft Order created with correct variant

### Story 9: Disconnect Shopify
**As a** business owner
**I want** to disconnect my Shopify store
**So that** I can switch to manual product management or different store

**Acceptance Criteria:**
- [ ] "Disconnect" button with confirmation dialog
- [ ] Warning: "Products will remain but won't sync. Future orders will use Stripe."
- [ ] Shopify webhooks unregistered
- [ ] OAuth token revoked
- [ ] Products remain in Echo with `source: "shopify"` (now orphaned, editable)
- [ ] Future orders use Stripe (if configured) or cash only

### Story 10: View Shopify Order in Dashboard
**As a** business owner
**I want** to see Shopify order details in Echo dashboard
**So that** I have full context without switching apps

**Acceptance Criteria:**
- [ ] Order detail page shows Shopify order number
- [ ] Link to open order in Shopify Admin
- [ ] Payment status synced from Shopify
- [ ] Fulfillment status synced from Shopify (if updated there)

## Technical Requirements

### Shopify App Setup
Echo must be a Shopify App (public or custom):
1. Create app in Shopify Partners dashboard
2. Configure OAuth redirect URL: `{ECHO_URL}/api/shopify/callback`
3. Set required scopes
4. For production: submit for Shopify app review (if public)

### OAuth Scopes Required
```
read_products        - Import and sync products
write_draft_orders   - Create orders for payment
read_orders          - Sync order status
read_inventory       - Check stock levels (optional)
```

### Environment Variables
```bash
SHOPIFY_API_KEY=xxx           # App API key
SHOPIFY_API_SECRET=xxx        # App secret (for OAuth + webhook verification)
SHOPIFY_SCOPES=read_products,write_draft_orders,read_orders
```

### API Endpoints (Convex Functions)

```typescript
// OAuth Flow
shopify.getAuthUrl({ businessId, shop })
// Returns: Shopify OAuth URL to redirect user

shopify.handleCallback({ businessId, code, shop, hmac })
// Exchanges code for access token, stores connection

// Product Sync
shopify.importProducts({ businessId })
// Fetches all products, creates/updates in Echo

shopify.syncProducts({ businessId })
// Manual resync trigger

shopify.handleProductWebhook({ topic, shop, payload, hmac })
// Handles products/create, products/update, products/delete

// Draft Orders (Payment)
shopify.createDraftOrder({ orderId })
// Creates Draft Order in Shopify, returns invoice_url

shopify.handleOrderWebhook({ topic, shop, payload, hmac })
// Handles orders/paid - updates Echo order status

// Connection Management
shopify.getConnectionStatus({ businessId })
shopify.disconnect({ businessId })
```

### HTTP Routes (Webhooks + OAuth)
```typescript
// OAuth callback
http.route({
  path: "/api/shopify/callback",
  method: "GET",
  handler: shopifyOAuthCallback,
});

// Shopify webhooks (products + orders)
http.route({
  path: "/webhook/shopify",
  method: "POST",
  handler: shopifyWebhookHandler,
});
```

### Shopify Admin API Calls

**Create Draft Order:**
```typescript
POST /admin/api/2024-01/draft_orders.json
{
  "draft_order": {
    "line_items": [
      {
        "variant_id": 123456789,
        "quantity": 2
      }
    ],
    "customer": {
      "phone": "+573001234567"
    },
    "shipping_address": {
      "address1": "Calle 85 #15-30",
      "city": "Bogota",
      "country": "Colombia",
      "phone": "+573001234567"
    },
    "note": "Order via Echo WhatsApp - Order #ECH-001234"
  }
}

// Response
{
  "draft_order": {
    "id": 987654321,
    "invoice_url": "https://store.myshopify.com/..../invoices/...",
    "status": "open",
    "total_price": "45000.00"
  }
}
```

**Fetch Products (with pagination):**
```typescript
GET /admin/api/2024-01/products.json?limit=250&status=active

// Handle pagination via Link header or page_info
```

## Data Model

### `shopifyConnections` table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| businessId | Id<"businesses"> | yes | Parent business |
| shop | string | yes | mystore.myshopify.com |
| accessToken | string | yes | Encrypted OAuth access token |
| scopes | string[] | yes | Granted OAuth scopes |
| webhookIds | object | no | { products: "123", orders: "456" } |
| lastSyncAt | number | no | Last successful product sync |
| lastSyncStatus | string | no | "success" \| "partial" \| "failed" |
| productCount | number | no | Number of synced products |
| createdAt | number | yes | Timestamp |
| updatedAt | number | yes | Timestamp |

### Updates to `products` table
| Field | Type | Description |
|-------|------|-------------|
| source | string | "manual" \| "shopify" |
| shopifyProductId | string | Shopify product ID |
| shopifyVariantId | string | Shopify variant ID |
| shopifyHandle | string | Product URL handle |
| lastShopifySyncAt | number | Last sync timestamp |

### Updates to `orders` table
| Field | Type | Description |
|-------|------|-------------|
| paymentProvider | string | "stripe" \| "shopify" \| "cash" |
| shopifyDraftOrderId | string | Draft Order ID (before payment) |
| shopifyOrderId | string | Order ID (after payment) |
| shopifyOrderNumber | string | Human-readable #1001 |
| shopifyInvoiceUrl | string | Payment link URL |

### Indexes
```typescript
shopifyConnections.by_business: [businessId]
shopifyConnections.by_shop: [shop]  // For webhook lookup
products.by_shopify_id: [businessId, shopifyProductId, shopifyVariantId]
orders.by_shopify_draft: [shopifyDraftOrderId]
```

## Payment Routing Logic

```typescript
async function generatePaymentLink(order: Order): Promise<string> {
  const business = await getBusiness(order.businessId);
  
  // Priority 1: Shopify (if connected)
  const shopifyConnection = await getShopifyConnection(business._id);
  if (shopifyConnection) {
    const draftOrder = await createShopifyDraftOrder(order, shopifyConnection);
    await updateOrder(order._id, {
      paymentProvider: "shopify",
      shopifyDraftOrderId: draftOrder.id,
      shopifyInvoiceUrl: draftOrder.invoice_url,
    });
    return draftOrder.invoice_url;
  }
  
  // Priority 2: Stripe (if configured)
  if (process.env.STRIPE_SECRET_KEY) {
    const session = await createStripeCheckoutSession(order);
    await updateOrder(order._id, {
      paymentProvider: "stripe",
      stripeSessionId: session.id,
      paymentLinkUrl: session.url,
    });
    return session.url;
  }
  
  // Priority 3: No payment provider
  throw new Error("No payment provider configured");
}
```

## UI/UX

### Pages
1. `/settings/integrations` - Integration hub
2. `/settings/integrations/shopify` - Shopify connection management

### Shopify Settings Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Shopify Integration                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Status: ✅ Connected                                 │   │
│  │ Store: mybusiness.myshopify.com                     │   │
│  │ Products synced: 47                                  │   │
│  │ Last sync: 2 hours ago                              │   │
│  │                                                      │   │
│  │ [Sync Now]  [View Products]  [Disconnect]           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Settings                                                   │
│  ─────────────────────────────────────────────────────────  │
│  ☑ Auto-sync products when changed in Shopify              │
│  ☑ Create orders in Shopify (use Shopify Payments)         │
│  ☐ Sync fulfillment status from Shopify                    │
│                                                             │
│  Payment Routing                                            │
│  ─────────────────────────────────────────────────────────  │
│  Current: Shopify Payments                                  │
│  Customers will pay through your Shopify checkout.          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Connect Flow
```
1. User clicks [Connect Shopify]
2. Modal asks for store URL: "mybusiness.myshopify.com"
3. Redirect to Shopify OAuth consent screen
4. User authorizes Echo app
5. Redirect back to Echo
6. Show success + [Import Products] button
7. Import runs with progress bar
8. Done - products appear in Echo
```

### Order Detail with Shopify
```
┌─────────────────────────────────────────────────────────────┐
│  Order #ECH-001234                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: Paid ✅                                            │
│  Payment: Shopify Payments                                  │
│  Shopify Order: #1089  [View in Shopify ↗]                 │
│                                                             │
│  Items:                                                     │
│  • 2x Cappuccino (Medium) - $9.00                          │
│  • 1x Croissant - $4.50                                    │
│                                                             │
│  Total: $22.50                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Webhook Security

All Shopify webhooks must be verified:

```typescript
function verifyShopifyWebhook(
  body: string,
  hmacHeader: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(hmacHeader)
  );
}
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| Shopify API rate limited | Exponential backoff, retry |
| Draft Order creation fails | Fall back to Stripe (if available) |
| Webhook signature invalid | Reject, log for monitoring |
| Product not found in Shopify | Mark as deleted in Echo |
| OAuth token revoked | Mark connection as invalid, prompt reconnect |
| Store uninstalls Echo app | Webhook notification, clean up connection |

## Success Metrics
- Product sync latency < 1 minute
- Draft Order creation success rate > 99%
- Payment completion rate > 95%
- Zero duplicate products from sync
- OAuth flow completion rate > 90%

## Dependencies
- Feature 01 (Business Onboarding) - business context
- Feature 02 (Product CMS) - product schema
- Feature 05 (Order Flow) - order schema, payment routing
- Shopify Partner account
- Shopify App approval (for production)

## Migration Path

For existing Echo users without Shopify:
1. Stripe continues to work as-is
2. Shopify integration is optional add-on
3. Connecting Shopify automatically switches payment routing
4. Can disconnect Shopify to revert to Stripe

## Open Questions
1. Should we support Shopify discount codes applied via chat?
2. How to handle products that exist in both Echo (manual) and Shopify?
3. Should we sync fulfillment status bidirectionally?
4. Do we need to handle Shopify's inventory reservations?
5. Should this be a paid feature tier?

## Appendix: Shopify App Review Requirements

For public Shopify app listing:
- Privacy policy URL
- App icon and screenshots
- Clear description of functionality
- Demonstration video
- Support contact
- GDPR compliance (data deletion webhook)

For custom/private app (single merchant):
- No review needed
- Create directly in store admin
- Limited to that one store
