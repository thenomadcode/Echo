# 02 - Product CMS - Product Requirements Document

## Overview
A simple product catalog management system where business owners can add, edit, and organize their products. This data powers the AI's ability to answer product questions and create orders.

## Problem Statement
For the AI to help customers:
1. Answer "What do you have?" or "How much is X?"
2. Create orders with correct products and prices

It needs access to the business's product catalog. We need a simple CMS where business owners can manage their products without requiring external integrations like Shopify.

## Goals
- Simple product CRUD (create, read, update, delete)
- Support product images
- Support categories for organization
- Support availability toggling (in stock / out of stock)
- Fast bulk operations (for businesses with many products)
- Data structure that AI can easily query and understand

## Non-Goals (Out of Scope)
- Inventory tracking with quantities (later)
- Product variants (size, color) - keep it simple for MVP
- Pricing tiers / discounts (later)
- Import from CSV/Excel (later, see Shopify sync)
- Public product page / storefront (Echo is not an e-commerce site)

## User Stories

### Story 1: Add Product
**As a** business owner  
**I want** to add a product to my catalog  
**So that** customers can order it via chat

**Acceptance Criteria:**
- [ ] Form with fields: name (required), description, price (required), category, image
- [ ] Price input handles local currency formatting
- [ ] Image upload to cloud storage (Convex file storage or external)
- [ ] Product is available by default after creation
- [ ] Success message and option to add another

### Story 2: View Product List
**As a** business owner  
**I want** to see all my products  
**So that** I can manage my catalog

**Acceptance Criteria:**
- [ ] Table/grid view of all products
- [ ] Shows: image thumbnail, name, price, category, availability status
- [ ] Sortable by name, price, category
- [ ] Filterable by category, availability
- [ ] Search by product name
- [ ] Pagination or infinite scroll for large catalogs

### Story 3: Edit Product
**As a** business owner  
**I want** to edit a product's details  
**So that** I can keep information accurate

**Acceptance Criteria:**
- [ ] Click product to open edit form
- [ ] All fields editable
- [ ] Can replace image
- [ ] Save updates immediately
- [ ] Cancel discards changes

### Story 4: Delete Product
**As a** business owner  
**I want** to delete a product  
**So that** discontinued items don't appear to customers

**Acceptance Criteria:**
- [ ] Delete button with confirmation dialog
- [ ] Soft delete (mark as deleted, don't remove from DB)
- [ ] Deleted products don't appear in AI responses
- [ ] Deleted products still visible in historical orders

### Story 5: Toggle Availability
**As a** business owner  
**I want** to quickly mark a product as unavailable  
**So that** customers don't try to order out-of-stock items

**Acceptance Criteria:**
- [ ] Toggle switch in product list view
- [ ] Quick action, no confirmation needed
- [ ] AI responds appropriately when product is unavailable
- [ ] Visual indicator (greyed out, badge) for unavailable products

### Story 6: Manage Categories
**As a** business owner  
**I want** to organize products into categories  
**So that** my catalog is organized and AI can help customers browse

**Acceptance Criteria:**
- [ ] Create/edit/delete categories
- [ ] Assign product to one category
- [ ] Reorder categories (drag & drop or manual order)
- [ ] Category shows product count
- [ ] Products can exist without a category (uncategorized)

### Story 7: Bulk Actions
**As a** business owner with many products  
**I want** to perform bulk actions  
**So that** I can manage my catalog efficiently

**Acceptance Criteria:**
- [ ] Multi-select products in list view
- [ ] Bulk mark as unavailable
- [ ] Bulk mark as available
- [ ] Bulk delete
- [ ] Bulk change category

## Technical Requirements

### Stack
- Frontend: TanStack Start + React
- Backend: Convex
- Image storage: Convex file storage (or Cloudflare R2 via Alchemy)

### API Endpoints (Convex Functions)

```typescript
// Products
products.create({ businessId, name, description?, price, categoryId?, imageId? })
products.update({ productId, ...fields })
products.delete({ productId }) // soft delete
products.list({ businessId, categoryId?, available?, search?, limit?, cursor? })
products.get({ productId })
products.bulkUpdateAvailability({ productIds, available })
products.bulkDelete({ productIds })
products.bulkUpdateCategory({ productIds, categoryId })

// Categories
categories.create({ businessId, name, order? })
categories.update({ categoryId, name?, order? })
categories.delete({ categoryId })
categories.list({ businessId })
categories.reorder({ businessId, orderedIds })
```

### Image Upload
```typescript
// Generate upload URL
products.generateUploadUrl()

// After upload, save file ID to product
products.update({ productId, imageId: fileId })
```

## Data Model

### `products` table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| businessId | Id<"businesses"> | yes | Parent business |
| name | string | yes | Product name |
| description | string | no | Product description |
| price | number | yes | Price in smallest currency unit (centavos) |
| currency | string | yes | "COP" \| "BRL" \| "MXN" \| "USD" (default from business) |
| categoryId | Id<"categories"> | no | Optional category |
| imageId | Id<"_storage"> | no | Convex file storage ID |
| available | boolean | yes | Is product available (default: true) |
| deleted | boolean | yes | Soft delete flag (default: false) |
| order | number | no | Display order within category |
| createdAt | number | yes | Timestamp |
| updatedAt | number | yes | Timestamp |

### `categories` table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| businessId | Id<"businesses"> | yes | Parent business |
| name | string | yes | Category name |
| order | number | yes | Display order |
| createdAt | number | yes | Timestamp |

### Indexes
- `products.by_business`: [businessId, deleted] - list products
- `products.by_category`: [categoryId, deleted, available] - list by category
- `categories.by_business`: [businessId] - list categories

## UI/UX

### Pages
1. `/products` - Product list with filters
2. `/products/new` - Create product form
3. `/products/[id]` - Edit product form
4. `/products/categories` - Category management

### Components
- `ProductCard` - Grid view card with image, name, price, toggle
- `ProductTable` - Table view for dense lists
- `ProductForm` - Create/edit form
- `CategoryManager` - Category CRUD
- `ImageUpload` - Drag & drop image upload
- `PriceInput` - Currency-aware price input

### Design Notes
- Default to grid view (more visual for products with images)
- Table view option for text-heavy catalogs
- Quick inline editing for availability toggle
- Show currency symbol appropriate to business locale
- Empty state with helpful CTA when no products

## Success Metrics
- Average products per business > 10
- Product creation time < 2 minutes
- Zero data loss from accidental deletion (soft delete)

## Dependencies
- Feature 01 (Business Onboarding) - need business context

## Open Questions
- Should we support multiple images per product?
- Do we need product variants (size S/M/L) for MVP?
- Should price include tax or be pre-tax?
