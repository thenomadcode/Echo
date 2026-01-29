# S06: Work with Smaller, Focused Files

## TL;DR

> **Quick Summary**: Refactor 6 large files (3 frontend routes + 3 backend modules) into smaller, focused modules (<500 lines each) following Echo's established patterns from `@/components/conversation/` and `integrations/meta/`.
> 
> **Deliverables**:
> - 8 new component files in `@/components/customers/`
> - 8 new component files in `@/components/settings/`
> - 1 new component file in `@/components/conversation/`
> - 8 new module files in `integrations/shopify/`
> - 6 new module files in `orders/`
> - 5 new handler files for `http.ts` refactoring
> 
> **Estimated Effort**: Large (6-8 hours total)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Frontend Tasks (independent) → Backend Shopify/Orders (parallel) → HTTP refactor (depends on Shopify)

---

## Context

### Original Request
Split 6 large files (3 frontend + 3 backend) into smaller, focused modules (<500 lines each) following Echo's established patterns.

### Interview Summary
**Key Discussions**:
- Frontend: Extract to centralized `@/components/{feature}/` directories (NO route-specific subdirectories)
- Backend: Follow `integrations/meta/` module pattern (actions.ts, queries.ts, types.ts, etc.)
- API paths change when moving to subdirectories (Convex file-based routing)
- No re-exports allowed in Convex (each function must be directly exported)
- HTTP router must remain in single file that exports `default http`

**Research Findings**:
- Existing `@/components/conversation/` has 5 well-extracted components (~69-333 lines each)
- Existing `integrations/meta/` has 6 files organized by responsibility
- Auth patterns use `requireAuth()` and `requireBusinessOwnership()` from `lib/auth.ts`
- Convex auto-generates API paths: `api.integrations.shopify.actions.*`

### Gap Analysis (Self-Reviewed)
**Identified Gaps** (addressed):
- API path breaking changes: Accepted, will update all imports
- HTTP crypto utilities: Extract to `lib/crypto.ts` for reuse
- Component prop interfaces: Must be explicitly defined for each extracted component
- Convex internal vs public functions: Must maintain correct function types

---

## Work Objectives

### Core Objective
Split 6 large files into smaller, focused modules (<500 lines each) while preserving all existing functionality and following established codebase patterns.

### Concrete Deliverables
| File | Current Lines | Target Lines | New Modules |
|------|---------------|--------------|-------------|
| `customers/$customerId.tsx` | 1,674 | ~150 | 8 components |
| `settings.tsx` | 736 | ~80 | 8 components |
| `conversations.$conversationId.tsx` | 613 | ~80 | 1 component |
| `shopify.ts` | 1,989 | N/A (deleted) | 8 modules |
| `http.ts` | 754 | ~100 | 5 handlers + crypto lib |
| `orders.ts` | 838 | N/A (deleted) | 6 modules |

### Definition of Done
- [ ] All new files are <500 lines
- [ ] `bun run check-types` passes with 0 errors
- [ ] `bun run check` passes with 0 errors
- [ ] Browser test: `/customers/[id]` - all 5 tabs render and switch correctly
- [ ] Browser test: `/settings` - all 4 settings sections render
- [ ] Browser test: `/conversations/[id]` - message list, input, and customer panel render
- [ ] All existing imports resolve (no broken references)

### Must Have
- Each extracted module has single responsibility
- All TypeScript types preserved
- All auth patterns maintained (requireAuth, requireBusinessOwnership)
- All Convex function types correct (query/mutation/action vs internal*)

### Must NOT Have (Guardrails)
- NO functional changes - only structural reorganization
- NO new features or business logic changes
- NO changes to files not listed in scope
- NO removal of any currently exported functions
- NO premature abstraction beyond what's specified
- NO additional test framework setup (manual verification only)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (no test framework configured)
- **User wants tests**: NO (manual verification per PRD)
- **Framework**: None
- **QA approach**: Manual browser verification + automated type/lint checks

### Automated Verification (ALL tasks)

**Type Checking:**
```bash
bun run check-types
# Assert: Exit code 0, no errors
```

**Lint/Format Checking:**
```bash
bun run check
# Assert: Exit code 0, no errors
```

### Browser Verification (Frontend tasks)

**Using playwright skill for automated browser testing:**

1. **Customer Detail Page** (`/customers/[id]`):
   ```
   1. Navigate to: http://localhost:3001/customers/[valid-customer-id]
   2. Assert: Page loads without errors
   3. Click each tab: Overview, Orders, Conversations, Preferences, Notes
   4. Assert: Each tab content renders
   5. Screenshot: .sisyphus/evidence/customer-tabs.png
   ```

2. **Settings Page** (`/settings`):
   ```
   1. Navigate to: http://localhost:3001/settings
   2. Assert: General section renders
   3. Click sidebar: AI & Automation, Chats, Shops
   4. Assert: Each section content renders
   5. Screenshot: .sisyphus/evidence/settings-sections.png
   ```

3. **Conversation Detail Page** (`/conversations/[id]`):
   ```
   1. Navigate to: http://localhost:3001/conversations/[valid-conversation-id]
   2. Assert: Message list renders
   3. Assert: Message input renders
   4. Assert: Customer panel renders (collapsed or expanded)
   5. Screenshot: .sisyphus/evidence/conversation-detail.png
   ```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - Frontend):
├── Task 1: Extract customers/$customerId.tsx components
├── Task 2: Extract settings.tsx components
└── Task 3: Extract conversations.$conversationId.tsx component

Wave 2 (Start Immediately - Backend):
├── Task 4: Refactor shopify.ts → integrations/shopify/
└── Task 5: Refactor orders.ts → orders/

Wave 3 (After Wave 2):
└── Task 6: Refactor http.ts handlers + extract crypto utilities

Wave 4 (After All):
└── Task 7: Final verification and browser tests
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 7 | 2, 3, 4, 5 |
| 2 | None | 7 | 1, 3, 4, 5 |
| 3 | None | 7 | 1, 2, 4, 5 |
| 4 | None | 6, 7 | 1, 2, 3, 5 |
| 5 | None | 6, 7 | 1, 2, 3, 4 |
| 6 | 4, 5 | 7 | None |
| 7 | 1, 2, 3, 6 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2, 3 | 3 parallel agents (frontend) |
| 2 | 4, 5 | 2 parallel agents (backend) |
| 3 | 6 | 1 sequential agent (http depends on shopify) |
| 4 | 7 | 1 final verification agent |

---

## TODOs

### Task 1: Extract Customer Detail Page Components

- [ ] 1. Extract `customers/$customerId.tsx` components to `@/components/customers/`

  **What to do**:
  1. Create directory structure: `apps/web/src/components/customers/tabs/`, `dialogs/`, `sections/`
  2. Extract `OverviewTab` (lines 353-462, ~109 lines) → `tabs/overview-tab.tsx`
  3. Extract `OrdersTab` (lines 465-541, ~76 lines) → `tabs/orders-tab.tsx`
  4. Extract `ConversationsTab` (lines 543-641, ~98 lines) → `tabs/conversations-tab.tsx`
  5. Extract `PreferencesTab` (lines 643-994, ~351 lines) → `tabs/preferences-tab.tsx`
  6. Extract `NotesTab` (lines 997-1283, ~286 lines) → `tabs/notes-tab.tsx`
  7. Extract `EditCustomerDialog` (lines 1285-1385, ~100 lines) → `dialogs/edit-customer-dialog.tsx`
  8. Extract `AddressesSection` (lines 1387-1674, ~287 lines) → `sections/addresses-section.tsx`
  9. Update route file to import from new locations
  10. Verify all props are properly typed

  **Must NOT do**:
  - Change any business logic
  - Add new features
  - Modify dialog behavior
  - Change component styling

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend component refactoring with UI verification needed
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React component extraction patterns
  - **Skills Evaluated but Omitted**:
    - `playwright`: Will be used in final verification task, not here

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 7 (final verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/web/src/components/conversation/message-bubble.tsx:1-69` - Component extraction pattern (props interface, named export)
  - `apps/web/src/components/products/product-form.tsx:1-100` - Complex component with form/mutation pattern
  - `apps/web/src/routes/_authenticated/customers/$customerId.tsx:353-462` - OverviewTab current implementation

  **Type References**:
  - `apps/web/src/routes/_authenticated/customers/$customerId.tsx:317-335` - CustomerContext type definition
  - `apps/web/src/routes/_authenticated/customers/$customerId.tsx:337-351` - OverviewTabProps interface

  **Import References**:
  - `apps/web/src/routes/_authenticated/customers/$customerId.tsx:1-67` - Current imports to distribute

  **WHY Each Reference Matters**:
  - message-bubble.tsx: Shows clean prop interface pattern with explicit types
  - product-form.tsx: Shows how to handle mutations and toast notifications in extracted components
  - Current file: Contains exact component boundaries and type definitions

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  bun run check-types
  # Assert: Exit code 0
  
  # Lint check passes  
  bun run check
  # Assert: Exit code 0
  
  # Verify new files exist
  ls apps/web/src/components/customers/tabs/
  # Assert: overview-tab.tsx, orders-tab.tsx, conversations-tab.tsx, preferences-tab.tsx, notes-tab.tsx exist
  
  ls apps/web/src/components/customers/dialogs/
  # Assert: edit-customer-dialog.tsx exists
  
  ls apps/web/src/components/customers/sections/
  # Assert: addresses-section.tsx exists
  ```

  **File Size Verification:**
  ```bash
  wc -l apps/web/src/routes/_authenticated/customers/\$customerId.tsx
  # Assert: <200 lines
  
  wc -l apps/web/src/components/customers/tabs/*.tsx
  # Assert: Each file <400 lines
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from type/lint checks
  - [ ] File line counts for all new files

  **Commit**: YES
  - Message: `refactor(customers): extract customer detail components to @/components/customers/`
  - Files: `apps/web/src/components/customers/**`, `apps/web/src/routes/_authenticated/customers/$customerId.tsx`
  - Pre-commit: `bun run check-types && bun run check`

---

### Task 2: Extract Settings Page Components

- [ ] 2. Extract `settings.tsx` components to `@/components/settings/`

  **What to do**:
  1. Create directory structure: `apps/web/src/components/settings/`, `integration-cards/`
  2. Extract `GeneralSettings` (lines 189-429, ~240 lines) → `general-settings.tsx`
  3. Extract `AISettings` (lines 486-548, ~62 lines) → `ai-settings.tsx`
  4. Extract `ChatsIntegrationsSettings` (lines 620-674, ~54 lines) → `chats-integrations-settings.tsx`
  5. Extract `ShopsIntegrationsSettings` (lines 677-682, ~5 lines) → `shops-integrations-settings.tsx`
  6. Extract `ShopifyIntegrationCard` (lines 551-617, ~66 lines) → `integration-cards/shopify-integration-card.tsx`
  7. Extract `MetaIntegrationCard` (lines 685-736, ~51 lines) → `integration-cards/meta-integration-card.tsx`
  8. Extract `StickySaveButton` (lines 432-483, ~51 lines) → `sticky-save-button.tsx`
  9. Update route file to import from new locations

  **Must NOT do**:
  - Change form validation logic
  - Modify toast notification behavior
  - Change integration status checking

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend component refactoring with form handling
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React form component patterns
  - **Skills Evaluated but Omitted**:
    - `playwright`: Will be used in final verification task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 7 (final verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/web/src/components/products/product-form.tsx:1-100` - TanStack Form usage pattern
  - `apps/web/src/components/integrations/meta-connection-status.tsx` - Integration status component pattern
  - `apps/web/src/routes/_authenticated/settings.tsx:189-429` - GeneralSettings current implementation

  **Type References**:
  - `apps/web/src/routes/_authenticated/settings.tsx:161-174` - Business interface
  - `apps/web/src/routes/_authenticated/settings.tsx:176-187` - SettingsFormProps interface

  **Import References**:
  - `apps/web/src/routes/_authenticated/settings.tsx:1-34` - Current imports to distribute

  **WHY Each Reference Matters**:
  - product-form.tsx: Shows TanStack Form + Convex mutation pattern
  - meta-connection-status.tsx: Shows integration status component pattern
  - Current file: Contains exact component boundaries and prop types

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  bun run check-types
  # Assert: Exit code 0
  
  # Lint check passes
  bun run check
  # Assert: Exit code 0
  
  # Verify new files exist
  ls apps/web/src/components/settings/
  # Assert: general-settings.tsx, ai-settings.tsx, chats-integrations-settings.tsx, shops-integrations-settings.tsx, sticky-save-button.tsx exist
  
  ls apps/web/src/components/settings/integration-cards/
  # Assert: shopify-integration-card.tsx, meta-integration-card.tsx exist
  ```

  **File Size Verification:**
  ```bash
  wc -l apps/web/src/routes/_authenticated/settings.tsx
  # Assert: <100 lines
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from type/lint checks
  - [ ] File line counts

  **Commit**: YES
  - Message: `refactor(settings): extract settings components to @/components/settings/`
  - Files: `apps/web/src/components/settings/**`, `apps/web/src/routes/_authenticated/settings.tsx`
  - Pre-commit: `bun run check-types && bun run check`

---

### Task 3: Extract Conversation Customer Panel

- [ ] 3. Extract `CustomerContextPanel` to `@/components/conversation/`

  **What to do**:
  1. Extract `CustomerContextPanel` (lines 50-227, ~177 lines) → `apps/web/src/components/conversation/customer-context-panel.tsx`
  2. Create proper TypeScript interface for props
  3. Update route file to import from new location
  4. Add to existing conversation components directory

  **Must NOT do**:
  - Change panel collapse/expand behavior
  - Modify customer context loading
  - Change any styling

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple single-component extraction
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React component extraction
  - **Skills Evaluated but Omitted**:
    - None - simple task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 7 (final verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/web/src/components/conversation/message-bubble.tsx:1-69` - Existing conversation component pattern
  - `apps/web/src/routes/_authenticated/conversations.$conversationId.tsx:50-227` - CustomerContextPanel implementation

  **Import References**:
  - `apps/web/src/routes/_authenticated/conversations.$conversationId.tsx:1-42` - Current imports

  **WHY Each Reference Matters**:
  - message-bubble.tsx: Shows the exact pattern used in this directory
  - Current file: Contains the component to extract

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  bun run check-types
  # Assert: Exit code 0
  
  # Verify new file exists
  ls apps/web/src/components/conversation/customer-context-panel.tsx
  # Assert: File exists
  
  wc -l apps/web/src/routes/_authenticated/conversations.\$conversationId.tsx
  # Assert: <100 lines
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from type check
  - [ ] Route file line count

  **Commit**: YES
  - Message: `refactor(conversation): extract CustomerContextPanel to @/components/conversation/`
  - Files: `apps/web/src/components/conversation/customer-context-panel.tsx`, `apps/web/src/routes/_authenticated/conversations.$conversationId.tsx`
  - Pre-commit: `bun run check-types && bun run check`

---

### Task 4: Refactor Shopify Module

- [ ] 4. Refactor `shopify.ts` → `integrations/shopify/` module structure

  **What to do**:
  1. Create directory: `packages/backend/convex/integrations/shopify/`
  2. Create `types.ts` - Move all type definitions (ShopifyTokenResponse, ShopifyGraphQLResponse, etc.)
  3. Create `utils.ts` - Move helper functions (normalizeShopUrl, generateStateParameter)
  4. Create `queries.ts` - Move public queries (getConnectionStatus)
  5. Create `mutations.ts` - Move internal mutations (saveConnection, updateSyncStatus, upsertProduct, etc.)
  6. Create `oauth.ts` - Move OAuth functions (getAuthUrl, handleCallback)
  7. Create `products.ts` - Move product sync functions (importProducts, syncProducts, handleProductWebhook logic)
  8. Create `webhooks.ts` - Move webhook functions (registerWebhooks, handleWebhook)
  9. Create `orders.ts` - Move order functions (createOrder, createOrderInternal, payment confirmation)
  10. Create `disconnect.ts` - Move disconnect functions
  11. Delete original `shopify.ts` file
  12. Update ALL imports across codebase to use new paths

  **Must NOT do**:
  - Change any function signatures
  - Modify business logic
  - Change auth patterns
  - Add new functionality

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex multi-file refactoring with API path changes
  - **Skills**: []
    - No specific skills needed - core Convex knowledge
  - **Skills Evaluated but Omitted**:
    - None needed for backend refactoring

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Task 6 (http.ts references shopify)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `packages/backend/convex/integrations/meta/actions.ts:1-100` - Module structure pattern (imports, exports)
  - `packages/backend/convex/integrations/meta/queries.ts:1-50` - Public query separation
  - `packages/backend/convex/integrations/meta/webhook.ts:1-100` - Webhook handling pattern
  - `packages/backend/convex/integrations/meta/types.ts` - Type definitions pattern

  **API References**:
  - `packages/backend/convex/shopify.ts:43-95` - getAuthUrl mutation
  - `packages/backend/convex/shopify.ts:107-182` - handleCallback action
  - `packages/backend/convex/shopify.ts:803-836` - getConnectionStatus query

  **Import Update Locations** (files that import from shopify.ts):
  - `packages/backend/convex/http.ts` - Shopify callback and webhook handlers
  - `apps/web/src/routes/_authenticated/settings.tsx` - ShopifyIntegrationCard
  - `apps/web/src/routes/_authenticated/settings_.integrations_.shopify.tsx` - Shopify settings page

  **WHY Each Reference Matters**:
  - meta/actions.ts: Exact pattern for structuring actions with internal helpers
  - meta/queries.ts: Shows clean query-only file structure
  - meta/webhook.ts: Shows webhook handler organization
  - Import locations: Must update all consumers of old API paths

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  bun run check-types
  # Assert: Exit code 0
  
  # Lint check passes
  bun run check
  # Assert: Exit code 0
  
  # Verify new directory structure
  ls packages/backend/convex/integrations/shopify/
  # Assert: types.ts, utils.ts, queries.ts, mutations.ts, oauth.ts, products.ts, webhooks.ts, orders.ts, disconnect.ts exist
  
  # Verify old file deleted
  ls packages/backend/convex/shopify.ts 2>&1
  # Assert: "No such file or directory"
  
  # Verify Convex can build
  cd packages/backend && bunx convex dev --once
  # Assert: Exit code 0, API generated successfully
  ```

  **File Size Verification:**
  ```bash
  wc -l packages/backend/convex/integrations/shopify/*.ts
  # Assert: Each file <500 lines
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from type check
  - [ ] Convex dev build output
  - [ ] File line counts

  **Commit**: YES
  - Message: `refactor(shopify): split shopify.ts into integrations/shopify/ module structure`
  - Files: `packages/backend/convex/integrations/shopify/**`, `packages/backend/convex/shopify.ts` (deleted)
  - Pre-commit: `bun run check-types`

---

### Task 5: Refactor Orders Module

- [ ] 5. Refactor `orders.ts` → `orders/` module structure

  **What to do**:
  1. Create directory: `packages/backend/convex/orders/`
  2. Create `types.ts` - Move OrderItem type
  3. Create `queries.ts` - Move public queries (get, getByConversation, getByOrderNumber, listByBusiness, listByCustomer)
  4. Create `mutations.ts` - Move CRUD mutations (create, addItem, removeItem, updateItemQuantity)
  5. Create `status.ts` - Move status transition mutations (cancel, markPreparing, markReady, markDelivered)
  6. Create `delivery.ts` - Move delivery mutations (setDeliveryInfo, setPaymentMethod)
  7. Create `payments.ts` - Move payment functions (generatePaymentLink, updatePaymentLink, updatePaymentLinkInternal, updateOrderPaymentStatus)
  8. Create `shopify.ts` - Move Shopify-specific functions (getShopifyConnectionForOrder, triggerShopifyOrderCreation)
  9. Delete original `orders.ts` file
  10. Update ALL imports across codebase to use new paths

  **Must NOT do**:
  - Change function signatures
  - Modify order status transitions
  - Change payment logic
  - Add new functionality

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex multi-file refactoring with API path changes
  - **Skills**: []
    - No specific skills needed
  - **Skills Evaluated but Omitted**:
    - None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 6 (http.ts references orders)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `packages/backend/convex/integrations/meta/actions.ts:1-100` - Module structure pattern
  - `packages/backend/convex/ai/process.ts:1-100` - Main entry point pattern

  **API References**:
  - `packages/backend/convex/orders.ts:22-92` - create mutation
  - `packages/backend/convex/orders.ts:421-443` - get query
  - `packages/backend/convex/orders.ts:612-716` - generatePaymentLink action

  **Import Update Locations**:
  - `packages/backend/convex/http.ts` - Stripe webhook updates order status
  - `packages/backend/convex/shopify.ts` (now integrations/shopify/) - Order creation
  - Frontend order pages

  **WHY Each Reference Matters**:
  - meta/actions.ts: Module organization pattern
  - Current file: Contains exact function boundaries

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  bun run check-types
  # Assert: Exit code 0
  
  # Verify new directory structure
  ls packages/backend/convex/orders/
  # Assert: types.ts, queries.ts, mutations.ts, status.ts, delivery.ts, payments.ts, shopify.ts exist
  
  # Verify old file deleted
  ls packages/backend/convex/orders.ts 2>&1
  # Assert: "No such file or directory"
  
  # Verify Convex can build
  cd packages/backend && bunx convex dev --once
  # Assert: Exit code 0
  ```

  **File Size Verification:**
  ```bash
  wc -l packages/backend/convex/orders/*.ts
  # Assert: Each file <500 lines
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from type check
  - [ ] Convex dev build output
  - [ ] File line counts

  **Commit**: YES
  - Message: `refactor(orders): split orders.ts into orders/ module structure`
  - Files: `packages/backend/convex/orders/**`, `packages/backend/convex/orders.ts` (deleted)
  - Pre-commit: `bun run check-types`

---

### Task 6: Refactor HTTP Handlers

- [ ] 6. Refactor `http.ts` handlers and extract crypto utilities

  **What to do**:
  1. Create `packages/backend/convex/lib/crypto.ts` - Extract sha256, verifyShopifySignature, verifyStripeSignature, computeHmacSha256*
  2. Create `packages/backend/convex/http/callbacks/shopify.ts` - Extract Shopify OAuth callback handler
  3. Create `packages/backend/convex/http/callbacks/meta.ts` - Extract Meta OAuth callback handler
  4. Create `packages/backend/convex/http/webhooks/shopify.ts` - Extract Shopify webhook handler
  5. Create `packages/backend/convex/http/webhooks/stripe.ts` - Extract Stripe webhook handler
  6. Keep main `http.ts` as router with imports from handlers
  7. Update handler imports to use new module paths (integrations/shopify/, orders/)
  8. Keep auth registration and WhatsApp/Meta webhooks in main file (already well-organized)

  **Must NOT do**:
  - Change route paths
  - Modify signature verification logic
  - Change webhook processing behavior
  - Remove auth registration

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex refactoring with cross-module dependencies
  - **Skills**: []
    - No specific skills needed
  - **Skills Evaluated but Omitted**:
    - None needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 7 (final verification)
  - **Blocked By**: Task 4, Task 5 (needs new module paths)

  **References** (CRITICAL):

  **Pattern References**:
  - `packages/backend/convex/integrations/meta/security.ts` - Crypto/verification pattern
  - `packages/backend/convex/http.ts:16-50` - Shopify callback handler
  - `packages/backend/convex/http.ts:428-474` - Shopify webhook handler
  - `packages/backend/convex/http.ts:477-544` - Stripe webhook handler

  **Crypto Functions to Extract** (lines 561-752):
  - `verifyStripeSignature` (lines 561-583)
  - `computeHmacSha256Sync` (lines 585-622)
  - `verifyShopifySignature` (lines 624-633)
  - `uint8ArrayToBase64` (lines 635-641)
  - `computeHmacSha256Raw` (lines 643-670)
  - `sha256` (lines 672-752)

  **WHY Each Reference Matters**:
  - meta/security.ts: Shows how to structure crypto utilities
  - Current file: Contains exact function boundaries for extraction

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  bun run check-types
  # Assert: Exit code 0
  
  # Verify new files exist
  ls packages/backend/convex/lib/crypto.ts
  # Assert: File exists
  
  ls packages/backend/convex/http/callbacks/
  # Assert: shopify.ts, meta.ts exist
  
  ls packages/backend/convex/http/webhooks/
  # Assert: shopify.ts, stripe.ts exist
  
  # Verify main http.ts is smaller
  wc -l packages/backend/convex/http.ts
  # Assert: <300 lines
  
  # Verify Convex can build
  cd packages/backend && bunx convex dev --once
  # Assert: Exit code 0
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from type check
  - [ ] Convex dev build output
  - [ ] File line counts

  **Commit**: YES
  - Message: `refactor(http): extract handlers and crypto utilities from http.ts`
  - Files: `packages/backend/convex/http.ts`, `packages/backend/convex/http/**`, `packages/backend/convex/lib/crypto.ts`
  - Pre-commit: `bun run check-types`

---

### Task 7: Final Verification and Browser Tests

- [ ] 7. Perform comprehensive verification across all changes

  **What to do**:
  1. Run full type check: `bun run check-types`
  2. Run full lint check: `bun run check`
  3. Start dev server: `bun run dev`
  4. Browser test: `/customers/[id]` - verify all 5 tabs
  5. Browser test: `/settings` - verify all 4 sections
  6. Browser test: `/conversations/[id]` - verify message list and panel
  7. Verify Convex dev builds successfully
  8. Document any remaining issues

  **Must NOT do**:
  - Make any code changes (verification only)
  - Skip any browser tests
  - Ignore type errors

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Browser verification required
  - **Skills**: [`playwright`]
    - `playwright`: Automated browser testing for UI verification
  - **Skills Evaluated but Omitted**:
    - None - this is the verification task

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 1, 2, 3, 6

  **References** (CRITICAL):

  **Test URLs**:
  - Customer detail: `http://localhost:3001/customers/[valid-id]`
  - Settings: `http://localhost:3001/settings`
  - Conversation: `http://localhost:3001/conversations/[valid-id]`

  **Verification Commands**:
  - `bun run check-types` - TypeScript validation
  - `bun run check` - Biome linting
  - `bun run dev` - Start dev server

  **WHY Each Reference Matters**:
  - Test URLs: Exact pages to verify
  - Commands: Automated checks to run

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Full type check
  bun run check-types
  # Assert: Exit code 0, 0 errors
  
  # Full lint check
  bun run check
  # Assert: Exit code 0
  
  # Build succeeds
  bun run build
  # Assert: Exit code 0
  ```

  **Browser Verification (using playwright skill):**
  ```
  # Customer Detail Page
  1. Navigate to: http://localhost:3001/customers/[get-valid-id-from-db]
  2. Wait for: Page load complete
  3. Click: "Orders" tab
  4. Assert: Orders table or empty state visible
  5. Click: "Conversations" tab
  6. Assert: Conversations list or empty state visible
  7. Click: "Preferences" tab
  8. Assert: Preferences content visible
  9. Click: "Notes" tab
  10. Assert: Notes content visible
  11. Screenshot: .sisyphus/evidence/task7-customer-tabs.png
  
  # Settings Page
  1. Navigate to: http://localhost:3001/settings
  2. Assert: General section visible
  3. Click: "AI & Automation" sidebar link
  4. Assert: AI settings visible
  5. Click: "Chats" sidebar link
  6. Assert: Chats integrations visible
  7. Click: "Shops" sidebar link
  8. Assert: Shops integrations visible
  9. Screenshot: .sisyphus/evidence/task7-settings-sections.png
  
  # Conversation Detail Page
  1. Navigate to: http://localhost:3001/conversations/[get-valid-id-from-db]
  2. Assert: Message list visible (or empty state)
  3. Assert: Message input visible at bottom
  4. Assert: Customer panel visible (collapsed or expanded)
  5. Screenshot: .sisyphus/evidence/task7-conversation.png
  ```

  **Evidence to Capture:**
  - [ ] Screenshots of all 3 pages
  - [ ] Terminal output from all checks
  - [ ] Convex build output

  **Commit**: NO (verification only, no changes)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `refactor(customers): extract customer detail components` | components/customers/**, routes/.../customers/$customerId.tsx | bun run check-types |
| 2 | `refactor(settings): extract settings components` | components/settings/**, routes/.../settings.tsx | bun run check-types |
| 3 | `refactor(conversation): extract CustomerContextPanel` | components/conversation/customer-context-panel.tsx, routes/.../conversations.$conversationId.tsx | bun run check-types |
| 4 | `refactor(shopify): split into integrations/shopify/ modules` | convex/integrations/shopify/**, convex/shopify.ts (del) | bunx convex dev --once |
| 5 | `refactor(orders): split into orders/ modules` | convex/orders/**, convex/orders.ts (del) | bunx convex dev --once |
| 6 | `refactor(http): extract handlers and crypto utilities` | convex/http.ts, convex/http/**, convex/lib/crypto.ts | bunx convex dev --once |
| 7 | (no commit - verification only) | - | Full browser tests |

---

## Success Criteria

### Verification Commands
```bash
# Type check (must pass)
bun run check-types

# Lint check (must pass)
bun run check

# Build (must succeed)
bun run build

# Convex build (must succeed)
cd packages/backend && bunx convex dev --once

# File size checks (all <500 lines)
wc -l apps/web/src/routes/_authenticated/customers/\$customerId.tsx  # <200
wc -l apps/web/src/routes/_authenticated/settings.tsx  # <100
wc -l apps/web/src/routes/_authenticated/conversations.\$conversationId.tsx  # <100
wc -l packages/backend/convex/http.ts  # <300
```

### Final Checklist
- [ ] All "Must Have" requirements present
- [ ] All "Must NOT Have" guardrails respected
- [ ] All 6 original files refactored
- [ ] All new files <500 lines
- [ ] All browser tests pass
- [ ] All type checks pass
- [ ] All lint checks pass
