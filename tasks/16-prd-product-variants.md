# 16 - Product Variants - Product Requirements Document

## Overview
Enable full product variant support (size, color, SKU, inventory tracking) across Echo's product catalog, e-commerce provider integrations (Shopify, WooCommerce, Tienda Nube), and AI conversation flow. Customers can browse and order specific variants through natural conversation with the AI assistant.

## Problem Statement
**Current Limitations:**
1. **No native variant support** - Products with options (size, color) are stored as separate product records
2. **Shopify sync workaround** - Each Shopify variant becomes a standalone Echo product (e.g., "Hoodie - Small", "Hoodie - Medium")
3. **Data duplication** - Shared attributes (description, category, images) repeated across variant products
4. **Limited features** - No SKU tracking, no per-variant inventory, no variant-specific pricing flexibility
5. **Poor UX** - Business owners must create/edit N duplicate products instead of one product with variants
6. **AI complexity** - AI groups products by `shopifyProductId` in prompts but database treats them as independent

**Why This Matters:**
- Most e-commerce products have variants (clothing sizes, product colors, package sizes)
- Competitors (Shopify, WooCommerce, Tienda Nube) all support variants natively
- Manual product management becomes tedious with variants
- Inventory tracking requires per-variant stock counts
- Future integrations (WooCommerce, Tienda Nube) need variant support

## Goals
- **Provider-agnostic variant system** - Works standalone and syncs with Shopify/WooCommerce/Tienda Nube
- **Full feature parity** - SKU, inventory tracking, variant options, variant-specific pricing/images
- **Simple products supported** - Products without variants remain simple (no forced complexity)
- **AI conversation flow** - AI naturally handles variant selection in chat ("I want the red one in medium")
- **Image delivery** - Variant images stored in Convex for WhatsApp/Instagram/Messenger delivery
- **Backward compatibility** - Existing orders/data continue to work during migration

## Non-Goals (Out of Scope)
- Two-way sync to providers (Echo remains read-only for synced products)
- Advanced inventory features (reservations, multi-location, backorders) - basic tracking only
- Product bundles or kits (later)
- Variant-specific shipping rules (later)
- Automatic variant generation UI (manual creation for MVP)
- Migration of existing production data (no production customers yet)

## User Stories

### Story 1: Create Product with Variants (Manual)
**As a** business owner  
**I want** to create a product with size and color options  
**So that** customers can choose the variant they want

**Acceptance Criteria:**
- [ ] Product form has "This product has variants" toggle
- [ ] When enabled, show variant options builder:
  - [ ] Add options: "Size", "Color", "Material" (max 3 options like Shopify)
  - [ ] Add values per option: Size = ["Small", "Medium", "Large"]
- [ ] Generate variant combinations automatically (3 sizes × 2 colors = 6 variants)
- [ ] Each variant has:
  - [ ] Name (auto-generated: "Small / Red" or manual override)
  - [ ] Price (can differ per variant)
  - [ ] SKU (optional)
  - [ ] Inventory quantity
  - [ ] Image (optional, overrides product image)
  - [ ] Availability toggle
- [ ] Parent product has default image and shared description
- [ ] Save creates 1 product + N variants (not N separate products)

### Story 2: Edit Product Variants
**As a** business owner  
**I want** to edit variant details  
**So that** I can update pricing, stock, or options

**Acceptance Criteria:**
- [ ] Edit product form shows variant table/list
- [ ] Bulk edit shared fields (description, category) updates parent only
- [ ] Inline edit variant-specific fields (price, stock, SKU)
- [ ] Add new variant to existing product
- [ ] Remove variant (soft delete, preserve order history)
- [ ] Change variant options (size values, color values)
- [ ] Upload variant-specific images

### Story 3: Import Shopify Products with Variants
**As a** business owner with Shopify  
**I want** to import products with variants  
**So that** Echo matches my Shopify catalog structure

**Acceptance Criteria:**
- [ ] Import creates 1 parent product + N variants (not N separate products like before)
- [ ] Maps Shopify product → Echo product:
  - [ ] Product title → `products.name`
  - [ ] Product description → `products.description`
  - [ ] Product image → `products.imageId` (download & upload to Convex)
  - [ ] `shopifyProductId` stored in `products.externalProductId`
- [ ] Maps Shopify variant → Echo variant:
  - [ ] Variant title → `productVariants.name`
  - [ ] Variant price → `productVariants.price` (convert to cents)
  - [ ] Variant SKU → `productVariants.sku`
  - [ ] Variant inventory → `productVariants.inventoryQuantity`
  - [ ] Variant options → `option1Name/Value`, `option2Name/Value`, `option3Name/Value`
  - [ ] Variant image → `productVariants.imageId` (download & upload to Convex)
  - [ ] `shopifyVariantId` stored in `productVariants.externalVariantId`
- [ ] If product has only 1 variant (no options) → create simple product (`hasVariants: false`)
- [ ] Import summary shows: "Imported X products with Y total variants"

### Story 4: Sync Shopify Variant Changes
**As a** business owner  
**I want** variant changes in Shopify to sync automatically  
**So that** Echo always shows current pricing/stock

**Acceptance Criteria:**
- [ ] Webhook `products/update` updates parent product and variants
- [ ] Price change in Shopify → updates variant price in Echo
- [ ] Stock change in Shopify → updates variant inventory in Echo
- [ ] New variant added in Shopify → creates variant in Echo
- [ ] Variant deleted in Shopify → marks variant unavailable in Echo
- [ ] Image change → downloads new image, uploads to Convex, updates `imageId`
- [ ] Sync status shows last sync timestamp per product

### Story 5: AI Recommends Product with Variants
**As a** customer chatting with AI  
**I want** to see variant options when asking about products  
**So that** I know what sizes/colors are available

**Acceptance Criteria:**
- [ ] Customer asks: "Do you have hoodies?"
- [ ] AI responds with product + variant options:
  ```
  Yes! We have our Classic Hoodie available in:
  • Small - $25.00 (5 in stock)
  • Medium - $25.00 (12 in stock)
  • Large - $30.00 (3 in stock)
  • Small / Red - $27.00 (Out of stock)
  
  Which one would you like?
  ```
- [ ] AI groups variants by parent product (not listed as separate products)
- [ ] Shows variant name, price, and availability
- [ ] Hides out-of-stock variants or marks them clearly

### Story 6: AI Handles Variant Selection
**As a** customer ordering a product  
**I want** to specify which variant I want  
**So that** I get the right size/color

**Acceptance Criteria:**
- [ ] Customer says: "I want a hoodie"
- [ ] AI detects product has variants → asks clarifying question:
  ```
  Which size would you like?
  • Small - $25.00
  • Medium - $25.00
  • Large - $30.00
  ```
- [ ] Customer responds: "Medium"
- [ ] AI matches response to variant, adds to order
- [ ] Customer says: "I want the red hoodie in small"
- [ ] AI extracts both options (color=red, size=small), matches to specific variant
- [ ] AI confirms: "Added Classic Hoodie (Small / Red) - $27.00 to your order"
- [ ] Order stores `variantId` (not just `productId`)

### Story 7: AI Handles Ambiguous Variant Requests
**As a** customer  
**I want** the AI to handle incomplete variant info  
**So that** I'm guided to make the right choice

**Acceptance Criteria:**
- [ ] Customer: "I want a large"
- [ ] AI: "Large in which color? We have Red ($27) and Blue ($27)"
- [ ] Customer: "I want the hoodie"
- [ ] AI: "Which size? Small ($25), Medium ($25), or Large ($30)?"
- [ ] Customer: "Do you have red?"
- [ ] AI: "Yes, our Classic Hoodie comes in red. Which size: Small ($27) or Medium ($27)?"
- [ ] AI never assumes variant choices, always confirms

### Story 8: Display Variants in Product List
**As a** business owner  
**I want** to see products with their variants  
**So that** I can manage my catalog efficiently

**Acceptance Criteria:**
- [ ] Product list shows parent products (not individual variants)
- [ ] Product card shows:
  - [ ] Product name
  - [ ] Price range if variants have different prices: "$25 - $30"
  - [ ] Total stock across all variants: "20 in stock"
  - [ ] Variant count badge: "3 variants"
- [ ] Click/expand shows variant list:
  ```
  Classic Hoodie
  ├─ Small - $25.00 (5 in stock) [Available]
  ├─ Medium - $25.00 (12 in stock) [Available]
  └─ Large - $30.00 (3 in stock) [Available]
  ```
- [ ] Quick actions: Edit product, Edit variants, Toggle availability

### Story 9: View Order with Variant Details
**As a** business owner  
**I want** to see which variant was ordered  
**So that** I can fulfill correctly

**Acceptance Criteria:**
- [ ] Order detail shows:
  ```
  Items:
  • Classic Hoodie - Small / Red × 2 - $54.00
    SKU: HOODIE-SM-RED
  • Croissant × 1 - $4.50
  ```
- [ ] Shows variant name, not just product name
- [ ] Shows SKU if available
- [ ] Links to parent product and specific variant

### Story 10: Send Product Image via WhatsApp
**As a** customer  
**I want** to see product images in chat  
**So that** I know what I'm ordering

**Acceptance Criteria:**
- [ ] Customer asks: "Show me the hoodie"
- [ ] AI retrieves product image from Convex storage
- [ ] AI sends image via WhatsApp Media API (requires public HTTPS URL)
- [ ] Image URL: `await ctx.storage.getUrl(product.imageId)`
- [ ] If variant has specific image, use `variant.imageId` instead of `product.imageId`
- [ ] Falls back to product image if variant has no image
- [ ] Works for Instagram DMs and Messenger (same URL-based approach)

### Story 11: Track Inventory per Variant
**As a** business owner  
**I want** stock levels tracked per variant  
**So that** I don't oversell

**Acceptance Criteria:**
- [ ] Each variant has `inventoryQuantity` field (default: 0)
- [ ] Each variant has `trackInventory` flag (default: true)
- [ ] When order is placed:
  - [ ] Check variant stock: `if (variant.inventoryQuantity < orderQuantity) → error`
  - [ ] Decrement stock: `variant.inventoryQuantity -= orderQuantity`
  - [ ] Mark variant unavailable if stock reaches 0
- [ ] If `trackInventory: false`, allow unlimited orders (digital products, services)
- [ ] Inventory synced from Shopify on import/webhook
- [ ] Manual inventory adjustment in Echo UI

### Story 12: Handle Simple Products (No Variants)
**As a** business owner  
**I want** some products to have no variants  
**So that** simple products don't have unnecessary complexity

**Acceptance Criteria:**
- [ ] Product form defaults to simple product (`hasVariants: false`)
- [ ] Simple products stored as:
  - [ ] 1 product record
  - [ ] 1 variant record (with empty `name`, all pricing/inventory in variant)
- [ ] AI treats simple products naturally (no variant selection needed)
- [ ] Order items reference `variantId` (consistent model)
- [ ] UI hides variant complexity for simple products (shows as single product)

## Technical Requirements

### Stack
- **Frontend**: TanStack Start + React
- **Backend**: Convex
- **Image Storage**: Convex storage (public HTTPS URLs for messaging APIs)
- **AI Provider**: OpenAI (configurable via env)

### Schema Changes

#### New `productVariants` table
```typescript
productVariants: defineTable({
  productId: v.id("products"),           // Parent product
  
  // Identification
  name: v.string(),                      // "Small / Red" or "" for simple products
  sku: v.optional(v.string()),           // "HOODIE-SM-RED"
  barcode: v.optional(v.string()),       // UPC/EAN/ISBN
  
  // Pricing
  price: v.number(),                     // In cents/centavos
  compareAtPrice: v.optional(v.number()), // Original price (for sales)
  costPrice: v.optional(v.number()),     // Cost basis (optional)
  
  // Inventory
  inventoryQuantity: v.number(),         // Stock count
  inventoryPolicy: v.union(
    v.literal("deny"),                   // Block overselling
    v.literal("continue")                // Allow backorders
  ),
  trackInventory: v.boolean(),           // Enable stock tracking
  
  // Variant options (max 3, Shopify-compatible)
  option1Name: v.optional(v.string()),   // "Size"
  option1Value: v.optional(v.string()),  // "Small"
  option2Name: v.optional(v.string()),   // "Color"
  option2Value: v.optional(v.string()),  // "Red"
  option3Name: v.optional(v.string()),   // "Material"
  option3Value: v.optional(v.string()),  // "Cotton"
  
  // Variant-specific image
  imageId: v.optional(v.string()),       // Convex storage ID (overrides product image)
  
  // Provider sync
  externalVariantId: v.optional(v.string()), // Shopify/WooCommerce variant ID
  lastSyncAt: v.optional(v.number()),
  
  // Physical attributes (for shipping)
  weight: v.optional(v.number()),        // In grams
  weightUnit: v.optional(v.string()),    // "g", "kg", "lb", "oz"
  requiresShipping: v.boolean(),         // Default: true
  
  // State
  available: v.boolean(),
  position: v.number(),                  // Display order
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_product", ["productId"])
.index("by_sku", ["sku"])
.index("by_external_id", ["externalVariantId"])
```

#### Updated `products` table
```typescript
products: defineTable({
  businessId: v.id("businesses"),
  name: v.string(),                      // "Classic Hoodie"
  description: v.optional(v.string()),
  categoryId: v.optional(v.string()),
  imageId: v.optional(v.string()),       // Default/fallback image
  
  // Variant flag
  hasVariants: v.boolean(),              // true = has options, false = simple product
  
  // Provider sync (generic, works for Shopify/WooCommerce/Tienda Nube)
  source: v.optional(v.union(
    v.literal("manual"),
    v.literal("shopify"),
    v.literal("woocommerce"),
    v.literal("tiendanube")
  )),
  externalProductId: v.optional(v.string()), // Provider's product ID
  lastSyncAt: v.optional(v.number()),
  
  // State
  available: v.boolean(),
  deleted: v.boolean(),
  order: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  
  // REMOVED FIELDS (moved to productVariants):
  // - price (now in variant)
  // - currency (derived from business)
  // - shopifyProductId (now externalProductId)
  // - shopifyVariantId (now in productVariants.externalVariantId)
})
.index("by_business", ["businessId", "deleted"])
.index("by_external_id", ["businessId", "source", "externalProductId"])
```

#### Updated `orders.items` structure
```typescript
orders: defineTable({
  // ... existing fields
  items: v.array(
    v.object({
      productId: v.id("products"),       // Parent product
      variantId: v.id("productVariants"), // Specific variant
      name: v.string(),                   // "Classic Hoodie"
      variantName: v.string(),            // "Small / Red" or "" for simple
      sku: v.optional(v.string()),        // For fulfillment
      quantity: v.number(),
      unitPrice: v.number(),              // From variant.price
      totalPrice: v.number(),
    }),
  ),
  // ... rest unchanged
})
```

### API Endpoints (Convex Functions)

```typescript
// Products (parent level)
products.create({ businessId, name, description?, categoryId?, imageId?, hasVariants })
products.update({ productId, name?, description?, categoryId?, imageId? })
products.delete({ productId })  // Soft delete product + all variants
products.list({ businessId, categoryId?, available?, search?, limit?, cursor? })
products.get({ productId })  // Returns product + variants

// Variants
variants.create({ productId, name, price, sku?, option1Name?, option1Value?, ... })
variants.update({ variantId, name?, price?, sku?, inventoryQuantity?, available?, ... })
variants.delete({ variantId })  // Soft delete variant
variants.list({ productId })  // List variants for a product
variants.get({ variantId })
variants.adjustInventory({ variantId, delta })  // +/- inventory

// Bulk operations
variants.bulkUpdatePrices({ variantIds, price })
variants.bulkAdjustInventory({ variantIds, delta })

// Shopify sync (updated for variants)
shopify.importProducts({ businessId })  // Creates products + variants
shopify.syncProducts({ businessId })    // Updates products + variants
shopify.handleProductWebhook({ topic, shop, payload, hmac })
```

### AI Prompt Changes

**Current approach (grouping workaround):**
```typescript
// Current: AI prompt groups products by shopifyProductId
const groupedProducts = products.reduce((acc, p) => {
  const key = p.shopifyProductId ?? `standalone_${p.name}`;
  if (!acc[key]) acc[key] = [];
  acc[key].push(p);
  return acc;
}, {});
// Shows: "Hoodie - Small ($25), Medium ($25), Large ($30)"
```

**New approach (native variants):**
```typescript
// New: Query products with variants eagerly
const productsWithVariants = await Promise.all(
  products.map(async (product) => {
    const variants = await ctx.db
      .query("productVariants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .filter((q) => q.eq(q.field("available"), true))
      .collect();
    return { ...product, variants };
  })
);

// AI prompt structure:
{
  "products": [
    {
      "id": "product_123",
      "name": "Classic Hoodie",
      "description": "Cozy cotton hoodie",
      "hasVariants": true,
      "variants": [
        {
          "id": "variant_456",
          "name": "Small / Red",
          "price": 2700,
          "sku": "HOODIE-SM-RED",
          "inventoryQuantity": 5,
          "options": { "size": "Small", "color": "Red" }
        },
        {
          "id": "variant_457",
          "name": "Medium / Blue",
          "price": 2700,
          "sku": "HOODIE-MD-BLU",
          "inventoryQuantity": 0,  // Out of stock
          "options": { "size": "Medium", "color": "Blue" }
        }
      ]
    }
  ]
}
```

**AI System Prompt Addition:**
```
## Product Variants

Some products have multiple variants (sizes, colors, etc.). When a customer asks about a product with variants:

1. Show all available variants with pricing and stock
2. Ask which variant they prefer if not specified
3. If customer mentions an option (e.g., "red" or "medium"), match to the correct variant
4. Always confirm the specific variant before adding to order
5. Never assume a variant choice - always ask if ambiguous

Example:
Customer: "I want a hoodie"
You: "Great! Our Classic Hoodie is available in:
• Small / Red - $27.00 (5 in stock)
• Small / Blue - $27.00 (Out of stock)
• Medium / Red - $27.00 (12 in stock)
• Medium / Blue - $27.00 (8 in stock)

Which one would you like?"

Customer: "Medium red"
You: "Perfect! Adding Classic Hoodie (Medium / Red) - $27.00 to your order."
```

### Image Upload Flow

**Shopify Import:**
```typescript
// For each product/variant with image URL
const imageUrl = shopifyProduct.image?.src;
if (imageUrl) {
  // Fetch image from Shopify CDN
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  
  // Upload to Convex storage
  const storageId = await ctx.storage.store(blob);
  
  // Save to product/variant
  await ctx.db.patch(productId, { imageId: storageId });
}
```

**Send via WhatsApp:**
```typescript
// Get public URL from Convex storage
const imageUrl = await ctx.storage.getUrl(variant.imageId ?? product.imageId);

// Send via WhatsApp Business API
await sendWhatsAppMedia({
  to: customerPhone,
  type: "image",
  image: { link: imageUrl },
  caption: `${product.name} - ${variant.name}`
});
```

## Data Migration

**Phase 1: Schema Migration**
```typescript
// 1. Add new tables: productVariants
// 2. Add hasVariants field to products
// 3. Rename shopifyProductId → externalProductId
// 4. Rename shopifyVariantId → externalVariantId (move to productVariants)
```

**Phase 2: Data Migration (no production data yet)**
```typescript
// For existing Shopify products (grouped by externalProductId):
// 1. Find products with same externalProductId
// 2. Pick first as parent, extract shared fields
// 3. Create productVariant for each original product
// 4. Delete original duplicate products

// Example:
// Before:
// Product 1: "Hoodie - Small", shopifyProductId: "gid://shopify/Product/123"
// Product 2: "Hoodie - Medium", shopifyProductId: "gid://shopify/Product/123"

// After:
// Product: "Hoodie", externalProductId: "gid://shopify/Product/123", hasVariants: true
// Variant 1: "Small", productId: Product._id, externalVariantId: "gid://shopify/ProductVariant/456"
// Variant 2: "Medium", productId: Product._id, externalVariantId: "gid://shopify/ProductVariant/457"
```

**Phase 3: Update Order Schema**
```typescript
// Update order.items to include variantId
// For old orders (before migration):
// - Keep existing productId reference
// - Set variantId to the product's first/only variant
```

## UI/UX

### Product Form (Create/Edit)

```
┌─────────────────────────────────────────────────────────────┐
│  Create Product                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Product Name *                                             │
│  [Classic Hoodie                                ]           │
│                                                             │
│  Description                                                │
│  [Cozy cotton hoodie perfect for...            ]           │
│                                                             │
│  Category                                                   │
│  [Clothing ▼]                                               │
│                                                             │
│  Product Image                                              │
│  [Upload Image] or drag & drop                             │
│                                                             │
│  ☑ This product has variants                               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Variant Options (max 3)                               │ │
│  │                                                        │ │
│  │ Option 1: [Size     ▼] Values: [S, M, L, XL         ] │ │
│  │ Option 2: [Color    ▼] Values: [Red, Blue, Black    ] │ │
│  │ + Add option                                          │ │
│  │                                                        │ │
│  │ [Generate Variants] (Creates 4×3 = 12 combinations)   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Variants (12)                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ │ Name       │ SKU         │ Price │ Stock │ Image   │ │
│  │ ├────────────┼─────────────┼───────┼───────┼─────────┤ │
│  │ │ S / Red    │ HOOD-S-RED  │ $25   │ 10    │ [📷]    │ │
│  │ │ S / Blue   │ HOOD-S-BLU  │ $25   │ 5     │ [📷]    │ │
│  │ │ S / Black  │ HOOD-S-BLK  │ $25   │ 0     │ [📷]    │ │
│  │ │ M / Red    │ HOOD-M-RED  │ $27   │ 15    │ [📷]    │ │
│  │ │ ...        │             │       │       │         │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  [Cancel]                                  [Save Product]  │
└─────────────────────────────────────────────────────────────┘
```

### Product List with Variants

```
┌─────────────────────────────────────────────────────────────┐
│  Products                                    [+ New Product] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [IMG]  Classic Hoodie                    $25 - $30  │   │
│  │         Clothing                       20 in stock   │   │
│  │         3 variants                                   │   │
│  │                                                       │   │
│  │  ▼ Show variants                                     │   │
│  │    ├─ Small / Red - $27 (5 in stock) ✅              │   │
│  │    ├─ Medium / Blue - $27 (12 in stock) ✅           │   │
│  │    └─ Large / Black - $30 (3 in stock) ✅            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [IMG]  Croissant                             $4.50  │   │
│  │         Bakery                           45 in stock │   │
│  │         Simple product                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Order Detail with Variants

```
┌─────────────────────────────────────────────────────────────┐
│  Order #ECH-001234                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Items:                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ • Classic Hoodie - Medium / Red × 2      $54.00     │   │
│  │   SKU: HOODIE-MD-RED                                │   │
│  │                                                      │   │
│  │ • Croissant × 1                           $4.50     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Subtotal:  $58.50                                          │
│  Delivery:   $5.00                                          │
│  Total:     $63.50                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### AI Conversation Example

```
Customer: Hola, tienes sudaderas?
AI: ¡Sí! Tenemos nuestra Sudadera Clásica disponible en:
    • Pequeña / Rojo - $27.00 (5 disponibles)
    • Mediana / Rojo - $27.00 (12 disponibles)
    • Grande / Negro - $30.00 (3 disponibles)
    
    ¿Cuál te gustaría?

Customer: La mediana roja
AI: ¡Perfecto! He agregado Sudadera Clásica (Mediana / Rojo) - $27.00 a tu pedido.
    
    ¿Te gustaría ordenar algo más?

Customer: No, eso es todo
AI: Entendido. Tu pedido:
    • Sudadera Clásica (Mediana / Rojo) × 1 - $27.00
    
    Total: $27.00
    
    ¿Prefieres entrega a domicilio o recoger en tienda?
```

## Success Metrics
- Product import time < 30 seconds for 100 products with variants
- AI variant matching accuracy > 95% (correct variant selected)
- Zero data duplication (1 product record instead of N)
- Inventory accuracy > 99% (no overselling)
- Image delivery success rate > 99% (WhatsApp/Instagram/Messenger)
- Simple product creation time < 1 minute
- Variant product creation time < 3 minutes (for 3 options × 3 values = 9 variants)

## Dependencies
- Feature 02 (Product CMS) - current product schema
- Feature 07 (Shopify Integration) - sync infrastructure
- Feature 04 (AI Conversation Engine) - conversation flow
- Feature 05 (Order Flow) - order schema updates
- Convex storage (for image upload/hosting)
- WhatsApp/Instagram/Messenger APIs (for image delivery)

## Migration Path

**For Existing Echo Users:**
1. No production customers yet → can trash existing data
2. Schema migration creates new tables
3. Shopify re-import creates proper variant structure
4. Manual products remain simple (no forced migration)

**For Future Integrations:**
- WooCommerce: Maps "product variations" to Echo variants (same structure)
- Tienda Nube: Maps "variantes" to Echo variants (same structure)
- All providers use same `externalProductId` / `externalVariantId` pattern

## Open Questions
1. Should we support more than 3 variant options? (Shopify limit is 3, WooCommerce allows unlimited)
   - **Decision: Stick with 3 max (industry standard, simpler UX)**

2. How to handle variant images with multiple images per variant (gallery)?
   - **Decision: MVP = 1 image per variant, gallery feature later**

3. Should AI proactively send product images when recommending?
   - **Decision: Yes, if product has image. "Here's our Classic Hoodie: [image]"**

4. How to handle discontinued variants (deleted in Shopify but in historical orders)?
   - **Decision: Soft delete variants, preserve in order history**

5. Should inventory tracking be optional per business (not just per variant)?
   - **Decision: Optional per variant (trackInventory flag), business sets default**

## Appendix: Provider Variant Mapping

### Shopify → Echo
```typescript
Shopify Product {
  id: "gid://shopify/Product/123",
  title: "Classic Hoodie",
  description_html: "<p>Cozy...</p>",
  image: { src: "https://cdn.shopify.com/..." },
  options: [
    { name: "Size", values: ["S", "M", "L"] },
    { name: "Color", values: ["Red", "Blue"] }
  ],
  variants: [
    {
      id: "gid://shopify/ProductVariant/456",
      title: "S / Red",
      price: "27.00",
      sku: "HOODIE-S-RED",
      inventory_quantity: 5,
      option1: "S",
      option2: "Red",
      image_id: 789
    }
  ]
}

→

Echo Product {
  name: "Classic Hoodie",
  description: "Cozy...",
  imageId: "convex_storage_id_1",
  hasVariants: true,
  source: "shopify",
  externalProductId: "gid://shopify/Product/123"
}

Echo Variants [
  {
    productId: "product_abc",
    name: "S / Red",
    price: 2700,
    sku: "HOODIE-S-RED",
    inventoryQuantity: 5,
    option1Name: "Size",
    option1Value: "S",
    option2Name: "Color",
    option2Value: "Red",
    externalVariantId: "gid://shopify/ProductVariant/456",
    imageId: "convex_storage_id_2"
  }
]
```

### WooCommerce → Echo (Future)
```typescript
WooCommerce Product {
  id: 123,
  name: "Classic Hoodie",
  type: "variable",
  description: "<p>Cozy...</p>",
  images: [{ src: "https://..." }],
  attributes: [
    { name: "Size", options: ["S", "M", "L"] },
    { name: "Color", options: ["Red", "Blue"] }
  ]
}

WooCommerce Variation {
  id: 456,
  attributes: { size: "S", color: "Red" },
  price: "27.00",
  sku: "HOODIE-S-RED",
  stock_quantity: 5
}

→ Same Echo structure with source: "woocommerce"
```

### Tienda Nube → Echo (Future)
```typescript
Tienda Nube Product {
  id: 123,
  name: { es: "Sudadera Clásica" },
  variants: [
    {
      id: 456,
      values: [
        { es: "Pequeña" },
        { es: "Rojo" }
      ],
      price: "27.00",
      sku: "HOODIE-S-RED",
      stock: 5
    }
  ]
}

→ Same Echo structure with source: "tiendanube"
```
