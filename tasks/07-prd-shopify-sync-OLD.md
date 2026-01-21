# 07 - Shopify Sync - Product Requirements Document

## Overview
Optional integration to import products from an existing Shopify store, keeping Echo's product catalog in sync. For businesses already using Shopify, this eliminates double data entry.

## Problem Statement
Many small businesses already have their products in Shopify. Asking them to re-enter everything in Echo is:
1. Time-consuming and error-prone
2. Creates data duplication issues
3. Requires manual sync when prices/availability change

Instead, we should pull product data from Shopify and keep it synced.

## Goals
- One-click import of all products from Shopify
- Automatic sync when products change in Shopify
- Support Shopify as the source of truth (Echo doesn't modify Shopify data)
- Optional: Create orders in Shopify when Echo processes an order

## Non-Goals (Out of Scope)
- Two-way sync (Echo modifying Shopify)
- Inventory management in Echo (Shopify handles this)
- Shopify themes or storefront integration
- Other e-commerce platforms (WooCommerce, etc.) - later
- Shopify POS integration

## User Stories

### Story 1: Connect Shopify Store
**As a** business owner with a Shopify store  
**I want** to connect my store to Echo  
**So that** my products are automatically available

**Acceptance Criteria:**
- [ ] Settings page has "Connect Shopify" option
- [ ] OAuth flow to authorize Echo app access
- [ ] Only requests necessary permissions (read products, read/write orders)
- [ ] Shows connection status after authorization
- [ ] Can disconnect at any time

### Story 2: Initial Product Import
**As a** business owner who just connected Shopify  
**I want** to import all my products  
**So that** Echo knows what I sell

**Acceptance Criteria:**
- [ ] "Import Products" button after connection
- [ ] Progress indicator during import
- [ ] Imports: product name, description, price, images, availability
- [ ] Handles products with variants (imports as separate products or smart grouping)
- [ ] Skips draft/archived products
- [ ] Shows import summary (X products imported, X skipped)
- [ ] Imported products appear in Echo's product list

### Story 3: Automatic Sync
**As a** business owner  
**I want** product changes in Shopify to reflect in Echo  
**So that** customers always see accurate info

**Acceptance Criteria:**
- [ ] Webhook receives Shopify product updates
- [ ] Price changes sync within 1 minute
- [ ] Availability changes sync within 1 minute
- [ ] New products automatically added
- [ ] Deleted products marked unavailable in Echo
- [ ] Sync status visible in settings

### Story 4: Manual Resync
**As a** business owner  
**I want** to manually trigger a resync  
**So that** I can ensure data is fresh

**Acceptance Criteria:**
- [ ] "Sync Now" button in settings
- [ ] Shows last sync timestamp
- [ ] Progress indicator during sync
- [ ] Shows what changed (X updated, X added)

### Story 5: Handle Variants
**As a** business with product variants  
**I want** variants handled intelligently  
**So that** customers can order the right option

**Acceptance Criteria:**
- [ ] Products with variants imported correctly
- [ ] Option 1: Each variant as separate product (simple)
- [ ] Option 2: Single product with variant selection in chat (advanced)
- [ ] AI asks clarifying questions ("Which size? S, M, or L")
- [ ] Correct variant/price recorded in order

### Story 6: Create Order in Shopify
**As a** business owner  
**I want** Echo orders to appear in Shopify  
**So that** I have one place for order management

**Acceptance Criteria:**
- [ ] When Echo order is confirmed, create order in Shopify
- [ ] Order includes: customer info, line items, delivery address
- [ ] Shopify order ID stored in Echo for reference
- [ ] Payment status synced back to Shopify
- [ ] If Shopify order creation fails, Echo order still works (graceful degradation)

### Story 7: Disconnect Shopify
**As a** business owner  
**I want** to disconnect my Shopify store  
**So that** I can switch to manual product management

**Acceptance Criteria:**
- [ ] "Disconnect" button in settings
- [ ] Confirmation dialog explaining impact
- [ ] Products remain in Echo (become manually managed)
- [ ] Webhook subscriptions removed
- [ ] OAuth tokens revoked

## Technical Requirements

### Shopify API
Use Shopify Admin API (GraphQL preferred for efficiency).

```typescript
// Required scopes
const SCOPES = [
  'read_products',     // Read product catalog
  'write_orders',      // Create orders
  'read_orders',       // Read order status
];
```

### OAuth Flow
```
1. User clicks "Connect Shopify"
2. Redirect to Shopify OAuth: /admin/oauth/authorize?client_id=X&scope=Y&redirect_uri=Z
3. User authorizes in Shopify
4. Shopify redirects back with code
5. Exchange code for access token
6. Store token securely
```

### Webhook Subscriptions
Subscribe to Shopify webhooks for real-time updates:
- `products/create`
- `products/update`
- `products/delete`
- `orders/paid` (if tracking payment in Shopify)

### Environment Variables
```bash
SHOPIFY_API_KEY=xxx
SHOPIFY_API_SECRET=xxx
SHOPIFY_SCOPES=read_products,write_orders,read_orders
```

### API Endpoints (Convex Functions)

```typescript
// OAuth
shopify.getAuthUrl({ businessId, shop })  // Generate OAuth URL
shopify.handleCallback({ businessId, code, shop })  // Exchange code for token

// Sync
shopify.importProducts({ businessId })  // Initial import
shopify.syncProducts({ businessId })  // Manual resync
shopify.handleWebhook({ topic, shop, data })  // Webhook handler

// Orders
shopify.createOrder({ orderId })  // Create Shopify order from Echo order
shopify.syncOrderStatus({ orderId })  // Sync payment status

// Connection
shopify.getConnectionStatus({ businessId })
shopify.disconnect({ businessId })
```

### HTTP Routes (Webhooks + OAuth Callback)
```typescript
http.route({
  path: "/shopify/callback",
  method: "GET",
  handler: shopifyOAuthCallback,
});

http.route({
  path: "/webhook/shopify",
  method: "POST",
  handler: shopifyWebhookHandler,
});
```

## Data Model

### `shopifyConnections` table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| businessId | Id<"businesses"> | yes | Parent business |
| shop | string | yes | mystore.myshopify.com |
| accessToken | string | yes | Encrypted OAuth token |
| scopes | array | yes | Granted scopes |
| webhookIds | array | no | Registered webhook IDs |
| lastSyncAt | number | no | Last successful sync |
| lastSyncStatus | string | no | "success" \| "partial" \| "failed" |
| createdAt | number | yes | Timestamp |

### Updates to `products` table
| Field | Type | Description |
|-------|------|-------------|
| source | string | "manual" \| "shopify" |
| shopifyProductId | string | Shopify product ID |
| shopifyVariantId | string | Shopify variant ID (if variant) |
| lastShopifySyncAt | number | When last synced from Shopify |

### Updates to `orders` table
| Field | Type | Description |
|-------|------|-------------|
| shopifyOrderId | string | Created Shopify order ID |
| shopifyOrderNumber | string | Shopify order number (#1001) |

### Indexes
- `shopifyConnections.by_business`: [businessId]
- `shopifyConnections.by_shop`: [shop] - for webhook lookup
- `products.by_shopify_id`: [businessId, shopifyProductId] - for sync lookup

## UI/UX

### Pages
1. `/settings/integrations` - Integration settings
2. `/settings/integrations/shopify` - Shopify-specific settings

### Shopify Settings View
```
┌─────────────────────────────────────────────────────────────┐
│  Shopify Integration                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Status: ✅ Connected                                       │
│  Store: myburgerplace.myshopify.com                        │
│  Last sync: 2 hours ago                                    │
│                                                             │
│  [Sync Now]  [View Products]  [Disconnect]                 │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Options:                                                   │
│  ☑ Auto-sync products when changed in Shopify              │
│  ☑ Create orders in Shopify                                │
│  ☐ Sync order status back to Shopify                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Connect Flow
```
1. [Connect Shopify] button
2. Enter shop URL (or auto-detect)
3. Redirect to Shopify login/authorize
4. Redirect back to Echo
5. Show "Connected!" + import prompt
6. [Import Products] → Progress → Done
```

### Design Notes
- Clear status indicator (connected/disconnected)
- Last sync timestamp with relative time
- Easy one-click resync
- Don't hide the disconnect option
- Show sync errors clearly with retry option

## Success Metrics
- Sync latency < 1 minute for product changes
- Import success rate > 99%
- Zero duplicate products from sync
- Order creation success rate > 99%

## Dependencies
- Feature 01 (Business Onboarding) - business context
- Feature 02 (Product CMS) - product schema to import into
- Feature 05 (Order Flow) - order schema for Shopify sync
- Shopify Partner account (for API credentials)

## Security Considerations
- Encrypt stored access tokens
- Verify webhook signatures (HMAC)
- Minimal scope requests (principle of least privilege)
- Token refresh handling (Shopify tokens don't expire, but handle revocation)

## Shopify App Requirements
To use Shopify API, Echo needs to be a Shopify app:
1. Create app in Shopify Partner dashboard
2. Configure OAuth redirect URLs
3. Set required scopes
4. For production: submit for Shopify app review

## Open Questions
- Should this be an optional paid feature?
- How to handle Shopify product variants elegantly in chat?
- Do we need to handle Shopify metafields?
- Should we support Shopify discount codes?
