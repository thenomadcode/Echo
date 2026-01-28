# S03 - Use Shared Auth Utilities

## TL;DR

> **Quick Summary**: Replace manual authentication checks across all backend files with centralized helpers from `lib/auth.ts`, fix security vulnerabilities where auth is completely missing, repair broken imports, and create internal mutations for AI-called order operations.
> 
> **Deliverables**:
> - Fix 2 broken imports (messages.ts, shopify.ts)
> - Add auth to 16 security gap mutations/queries (was 15, +1 conversations.addMessage)
> - Refactor 30 manual auth checks to use helpers (was 25, +5 conversations.ts mutations)
> - Create 3 internal mutations for AI order operations
> - Fix businessId type in products.ts
> - All TypeScript compilation passes
> 
> **Estimated Effort**: Medium-Large
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 7 → Task 13

---

## Context

### Original Request
Implement S03 - Use Shared Auth Utilities from the PRD. Replace 50+ manual auth checks with centralized helper functions.

### Interview Summary
**Key Discussions**:
- Shared auth utilities in `packages/backend/convex/lib/auth.ts` already exist with 4 functions
- PRD said 50+ checks but analysis found ~30 manual checks + 16 security gaps + 2 broken imports
- User decided: Full scope (fix everything), fix types, TypeScript + manual verification

**Research Findings**:
- `businesses.ts` already uses helpers correctly - no changes needed
- `orders.ts` has 10 mutations with ZERO auth - but 3 are called by AI agent!
- `messages.ts` and `shopify.ts` have broken imports causing TypeScript errors
- `products.ts` uses `v.string()` instead of `v.id("businesses")` - prevents helper usage
- `conversations.ts` has 9 auth patterns (not 4 as initially counted) + 1 missing auth

### Momus Review Findings (CRITICAL)
1. **Orders.ts AI Conflict**: `orders.create`, `orders.setDeliveryInfo`, `orders.setPaymentMethod` are called by AI agent. Adding auth would break AI.
   - **Solution**: Create internal mutations for AI, auth on public mutations
2. **Conversations.ts Undercount**: Has 9 auth patterns (4 queries + 5 mutations), not 4
3. **Missing Security Gap**: `conversations.addMessage` has NO auth

---

## Work Objectives

### Core Objective
Consolidate all authentication logic into shared helpers, eliminating code duplication and ensuring consistent auth patterns across the entire backend, while preserving AI functionality.

### Concrete Deliverables
- `packages/backend/convex/messages.ts` - Fixed import + auth on findMessageByContent
- `packages/backend/convex/shopify.ts` - Fixed import + auth on importProducts/createOrder + refactored checks
- `packages/backend/convex/orders.ts` - Internal mutations for AI + auth on public mutations
- `packages/backend/convex/customers.ts` - Auth on updateStats + 8 refactored checks
- `packages/backend/convex/products.ts` - Type fixed + 7 refactored checks
- `packages/backend/convex/conversations.ts` - Auth on addMessage + 9 refactored checks
- `packages/backend/convex/integrations/whatsapp/settings.ts` - Auth on testConnection + 2 refactored checks

### Definition of Done
- [ ] `bun run check-types` passes with zero errors
- [ ] All public mutations use `requireAuth()` or `requireBusinessOwnership()`
- [ ] All public queries use `getAuthUser()` or `isBusinessOwner()`
- [ ] No direct `authComponent.safeGetAuthUser()` calls outside lib/auth.ts
- [ ] No manual `business.ownerId !== authUser._id` patterns remain
- [ ] AI agent continues to work (calls internal mutations)

### Must Have
- All security vulnerabilities fixed (auth added where missing)
- All broken imports fixed (TypeScript compiles)
- Internal mutations for AI-called operations
- Consistent error messages across all files
- Type safety with `v.id("businesses")` in products.ts

### Must NOT Have (Guardrails)
- DO NOT add auth to `internalMutation` or `internalQuery` functions - they're internal-only by design
- DO NOT change auth behavior - queries return null, mutations throw
- DO NOT add new helper functions to lib/auth.ts - use existing 4 functions only
- DO NOT refactor businesses.ts - it's already correct
- DO NOT add test infrastructure - verification is TypeScript + manual only
- DO NOT change frontend code unless absolutely necessary for type safety
- DO NOT break AI agent functionality - it must still be able to create/modify orders

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: NO (TypeScript + manual verification)
- **Framework**: none

### Automated Verification (Agent-Executable)

**For all tasks - TypeScript Compilation:**
```bash
# Agent runs after each file change:
bun run check-types
# Assert: Exit code 0, no errors
```

**For all tasks - LSP Diagnostics:**
```bash
# Agent checks via LSP:
mcp_lsp_diagnostics on changed file
# Assert: No ERROR level diagnostics
```

**For orders.ts - AI Functionality Check:**
```bash
# Verify internal mutations exist and are exported:
grep -c "export const createInternal\|export const setDeliveryInfoInternal\|export const setPaymentMethodInternal" packages/backend/convex/orders.ts
# Assert: 3 matches
```

**Final Verification - Auth Pattern Consistency:**
```bash
# Search for remaining manual patterns:
grep -r "authComponent.safeGetAuthUser" packages/backend/convex/*.ts --include="*.ts" | grep -v "lib/auth.ts"
# Assert: No matches (all moved to helpers)

grep -r "business.ownerId !== authUser._id" packages/backend/convex/
# Assert: No matches (all using helpers)
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Start Immediately - CRITICAL):
├── Task 1: Fix messages.ts broken import
└── Task 2: Fix shopify.ts broken import

Wave 1 (After Wave 0 - Security Fixes + Internal Mutations):
├── Task 3: Create orders.ts internal mutations + add auth to public mutations
├── Task 4: Add auth to customers.ts updateStats
├── Task 5: Add auth to shopify.ts importProducts & createOrder
├── Task 6: Add auth to whatsapp testConnection + messages findMessageByContent
└── Task 7: Add auth to conversations.ts addMessage

Wave 2 (After Wave 1 - Type Fix):
└── Task 8: Fix products.ts businessId type + refactor 7 checks

Wave 3 (After Wave 2 - Refactoring, PARALLEL):
├── Task 9: Refactor customers.ts 8 manual checks
├── Task 10: Refactor conversations.ts 9 manual checks (4 queries + 5 mutations)
├── Task 11: Refactor shopify.ts 3 manual checks
└── Task 12: Refactor whatsapp/settings.ts 2 manual checks

Wave 4 (After Wave 3 - Verification):
└── Task 13: Final verification and cleanup

Critical Path: Task 1 → Task 2 → Task 3 → Task 8 → Task 13
Parallel Speedup: ~45% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4, 6, 7 | 2 |
| 2 | None | 5, 11 | 1 |
| 3 | 1 | 13 | 4, 5, 6, 7 |
| 4 | 1 | 9, 13 | 3, 5, 6, 7 |
| 5 | 2 | 11, 13 | 3, 4, 6, 7 |
| 6 | 1 | 12, 13 | 3, 4, 5, 7 |
| 7 | 1 | 10, 13 | 3, 4, 5, 6 |
| 8 | 3, 4, 5, 6, 7 | 9, 10, 11, 12 | None |
| 9 | 4, 8 | 13 | 10, 11, 12 |
| 10 | 7, 8 | 13 | 9, 11, 12 |
| 11 | 5, 8 | 13 | 9, 10, 12 |
| 12 | 6, 8 | 13 | 9, 10, 11 |
| 13 | 9, 10, 11, 12 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 0 | 1, 2 | Parallel, quick category |
| 1 | 3, 4, 5, 6, 7 | Parallel, unspecified-low category (Task 3 is unspecified-high) |
| 2 | 8 | Sequential, unspecified-low category |
| 3 | 9, 10, 11, 12 | Parallel, quick category |
| 4 | 13 | Sequential, quick category |

---

## TODOs

### Wave 0: Fix Broken Imports (CRITICAL - Blocks Compilation)

- [ ] 1. Fix messages.ts broken import

  **What to do**:
  - Add missing import at top of file: `import { requireAuth, getAuthUser, isBusinessOwner } from "./lib/auth";`
  - Verify the existing `requireAuth(ctx)` call on line 13 now resolves

  **Must NOT do**:
  - Do NOT change any auth logic - just add the import
  - Do NOT refactor the manual ownership check (that's Task 6)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line import addition, trivial change
  - **Skills**: `[]`
    - No special skills needed for import fix

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Task 2)
  - **Blocks**: Tasks 3, 4, 6, 7
  - **Blocked By**: None (can start immediately)

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/customers.ts:3` - Correct import pattern: `import { getAuthUser, requireAuth } from "./lib/auth";`
  - `packages/backend/convex/products.ts:4` - Another example of correct import

  **File to Modify**:
  - `packages/backend/convex/messages.ts:1` - Add import after existing imports

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: No error about "Cannot find name 'requireAuth'" in messages.ts
  
  # LSP check:
  mcp_lsp_diagnostics on packages/backend/convex/messages.ts
  # Assert: No ERROR diagnostics
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `fix(backend): add missing auth imports in messages.ts and shopify.ts`
  - Files: `packages/backend/convex/messages.ts`
  - Pre-commit: `bun run check-types`

---

- [ ] 2. Fix shopify.ts broken import

  **What to do**:
  - Add missing import at top of file: `import { authComponent } from "./auth";`
  - Verify the 3 existing `authComponent.safeGetAuthUser(ctx)` calls (lines 48, 809, 1196) now resolve

  **Must NOT do**:
  - Do NOT change any auth logic - just add the import
  - Do NOT refactor to use lib/auth helpers yet (that's Task 11)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line import addition, trivial change
  - **Skills**: `[]`
    - No special skills needed for import fix

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 0 (with Task 1)
  - **Blocks**: Tasks 5, 11
  - **Blocked By**: None (can start immediately)

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/conversations.ts:4` - Correct import pattern: `import { authComponent } from "./auth";`
  - `packages/backend/convex/integrations/whatsapp/settings.ts:4` - Another example

  **File to Modify**:
  - `packages/backend/convex/shopify.ts:1-11` - Add import in the import block

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: No errors about "Cannot find name 'authComponent'" in shopify.ts
  
  # LSP check:
  mcp_lsp_diagnostics on packages/backend/convex/shopify.ts
  # Assert: No ERROR diagnostics
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `fix(backend): add missing auth imports in messages.ts and shopify.ts`
  - Files: `packages/backend/convex/shopify.ts`
  - Pre-commit: `bun run check-types`

---

### Wave 1: Critical Security Fixes (Add Auth Where Missing)

- [ ] 3. Create orders.ts internal mutations and add auth to public mutations (CRITICAL)

  **What to do**:
  
  This is a complex task with TWO parts:

  **Part A - Create internal mutations for AI-called operations**:
  
  The AI agent (`ai/agent.ts`, `ai/process.ts`) calls these mutations:
  - `orders.create`
  - `orders.setDeliveryInfo`
  - `orders.setPaymentMethod`

  Create internal versions that the AI will call instead:
  ```typescript
  export const createInternal = internalMutation({
    args: { /* same args as create */ },
    handler: async (ctx, args) => {
      // Move existing create logic here (no auth check)
    },
  });
  ```

  **Part B - Add auth to public mutations**:
  
  Modify public mutations to:
  1. Add auth check
  2. Delegate to internal mutation

  ```typescript
  export const create = mutation({
    args: { /* same args */ },
    handler: async (ctx, args) => {
      await requireBusinessOwnership(ctx, args.businessId);
      return ctx.runMutation(internal.orders.createInternal, args);
    },
  });
  ```

  **Part C - Add auth to frontend-only mutations**:
  
  These mutations are ONLY called from frontend (not AI):
  - `addItem` - Add auth via order.businessId
  - `removeItem` - Add auth via order.businessId
  - `updateItemQuantity` - Add auth via order.businessId
  - `cancel` - Add auth via order.businessId
  - `markPreparing` - Add auth via order.businessId
  - `markReady` - Add auth via order.businessId
  - `markDelivered` - Add auth via order.businessId

  Pattern for mutations with orderId:
  ```typescript
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    await requireBusinessOwnership(ctx, order.businessId);
    // ... rest of handler
  }
  ```

  **Part D - Update AI callers**:
  
  Update `ai/agent.ts` and `ai/process.ts` to call internal mutations:
  ```typescript
  // Change from:
  await ctx.runMutation(api.orders.create, { ... });
  // To:
  await ctx.runMutation(internal.orders.createInternal, { ... });
  ```

  **Summary of changes**:
  | Mutation | Current Callers | Change |
  |----------|-----------------|--------|
  | create | AI + (maybe frontend) | Create `createInternal`, public calls internal |
  | setDeliveryInfo | AI | Create `setDeliveryInfoInternal`, public calls internal |
  | setPaymentMethod | AI | Create `setPaymentMethodInternal`, public calls internal |
  | addItem | None currently | Add auth directly |
  | removeItem | None currently | Add auth directly |
  | updateItemQuantity | None currently | Add auth directly |
  | cancel | Frontend | Add auth directly |
  | markPreparing | Frontend | Add auth directly |
  | markReady | Frontend | Add auth directly |
  | markDelivered | Frontend | Add auth directly |

  **Must NOT do**:
  - Do NOT modify the existing queries (get, getByConversation, etc.) - they already have auth
  - Do NOT change the return types or error messages
  - Do NOT forget to update AI callers to use internal mutations

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex refactoring with multiple files, internal mutation creation, AI caller updates
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 4, 5, 6, 7)
  - **Blocks**: Task 13
  - **Blocked By**: Task 1

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/lib/auth.ts:1-45` - The auth helper implementations
  - `packages/backend/convex/businesses.ts:70-95` - Example of requireBusinessOwnership usage in update mutation
  - `packages/backend/convex/shopify.ts:193` - Example of internal mutation pattern (`saveConnection`)

  **AI Caller Files to Update**:
  - `packages/backend/convex/ai/agent.ts:631-655` - Change api.orders.* to internal.orders.*Internal
  - `packages/backend/convex/ai/process.ts:801-827` - Change api.orders.* to internal.orders.*Internal

  **File to Modify**:
  - `packages/backend/convex/orders.ts` - All 10 mutations + create 3 internal mutations
  - `packages/backend/convex/ai/agent.ts` - Update to use internal mutations
  - `packages/backend/convex/ai/process.ts` - Update to use internal mutations

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify internal mutations created:
  grep -c "export const createInternal\|export const setDeliveryInfoInternal\|export const setPaymentMethodInternal" packages/backend/convex/orders.ts
  # Assert: 3 matches
  
  # Verify AI uses internal mutations:
  grep -c "internal.orders.createInternal\|internal.orders.setDeliveryInfoInternal\|internal.orders.setPaymentMethodInternal" packages/backend/convex/ai/agent.ts
  # Assert: At least 3 matches
  
  grep -c "internal.orders.createInternal\|internal.orders.setDeliveryInfoInternal\|internal.orders.setPaymentMethodInternal" packages/backend/convex/ai/process.ts
  # Assert: At least 3 matches
  
  # Verify auth added to public mutations:
  grep -c "requireAuth\|requireBusinessOwnership" packages/backend/convex/orders.ts
  # Assert: At least 10 matches
  ```

  **Commit**: YES
  - Message: `fix(backend): add auth to orders.ts and create internal mutations for AI`
  - Files: `packages/backend/convex/orders.ts`, `packages/backend/convex/ai/agent.ts`, `packages/backend/convex/ai/process.ts`
  - Pre-commit: `bun run check-types`

---

- [ ] 4. Add auth to customers.ts updateStats mutation

  **What to do**:
  - Locate `updateStats` mutation (around line 291)
  - Add authentication check at the start of the handler:
  ```typescript
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    await requireBusinessOwnership(ctx, customer.businessId);
    // ... rest of existing handler
  }
  ```

  **Must NOT do**:
  - Do NOT modify other functions in this file (refactoring is Task 9)
  - Do NOT change the internal mutations (getOrCreate, updateStatsInternal)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single function modification, straightforward pattern
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 5, 6, 7)
  - **Blocks**: Tasks 9, 13
  - **Blocked By**: Task 1

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/customers.ts:137-146` - The `create` mutation shows the correct auth pattern for this file
  - `packages/backend/convex/lib/auth.ts:23-32` - requireBusinessOwnership implementation

  **File to Modify**:
  - `packages/backend/convex/customers.ts:291-319` - updateStats mutation

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify auth added:
  grep -A5 "export const updateStats" packages/backend/convex/customers.ts | grep -c "requireAuth\|requireBusinessOwnership"
  # Assert: At least 1 match
  ```

  **Commit**: YES
  - Message: `fix(backend): add auth check to customers.ts updateStats mutation`
  - Files: `packages/backend/convex/customers.ts`
  - Pre-commit: `bun run check-types`

---

- [ ] 5. Add auth to shopify.ts importProducts and createOrder actions

  **What to do**:
  - Locate `importProducts` action (around line 332)
  - Locate `createOrder` action (around line 1331)
  - Add auth verification using `verifyBusinessOwnership` internal query (already exists in file at line 1191)
  
  **Pattern for actions** (actions can't use ctx.db directly):
  ```typescript
  handler: async (ctx, args) => {
    const authCheck = await ctx.runQuery(internal.shopify.verifyBusinessOwnership, {
      businessId: args.businessId,
    });
    if (!authCheck.authorized) {
      throw new Error(authCheck.error ?? "Not authorized");
    }
    // ... rest of handler
  }
  ```

  **Must NOT do**:
  - Do NOT modify the existing `verifyBusinessOwnership` internal query
  - Do NOT refactor existing manual checks (that's Task 11)
  - Do NOT add auth to internal actions (handleWebhook, etc.)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Two functions to modify, need to understand action pattern
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 4, 6, 7)
  - **Blocks**: Tasks 11, 13
  - **Blocked By**: Task 2

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/shopify.ts:1042-1080` - `syncProducts` action shows correct pattern using verifyBusinessOwnership
  - `packages/backend/convex/shopify.ts:1191-1212` - The verifyBusinessOwnership internal query implementation
  - `packages/backend/convex/shopify.ts:1554-1600` - `disconnect` action also shows correct pattern

  **File to Modify**:
  - `packages/backend/convex/shopify.ts:332` - importProducts action
  - `packages/backend/convex/shopify.ts:1331` - createOrder action

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify auth added to importProducts:
  grep -A10 "export const importProducts" packages/backend/convex/shopify.ts | grep -c "verifyBusinessOwnership"
  # Assert: At least 1 match
  
  # Verify auth added to createOrder:
  grep -A10 "export const createOrder" packages/backend/convex/shopify.ts | grep -c "verifyBusinessOwnership\|authorized"
  # Assert: At least 1 match
  ```

  **Commit**: YES
  - Message: `fix(backend): add auth checks to shopify.ts importProducts and createOrder`
  - Files: `packages/backend/convex/shopify.ts`
  - Pre-commit: `bun run check-types`

---

- [ ] 6. Add auth to whatsapp testConnection and messages findMessageByContent

  **What to do**:
  
  **Part A - whatsapp/settings.ts testConnection action** (line 156):
  - This is an `action`, so use the existing auth check pattern from saveCredentials
  - Add at start of handler:
  ```typescript
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser || !authUser._id) {
    throw new Error("Not authenticated");
  }
  // Then verify business ownership via internal query or inline check
  ```

  **Part B - messages.ts findMessageByContent query** (line 131):
  - Add auth check that returns null if not authenticated (graceful query pattern)
  - Need to verify user owns the business that owns the conversation:
  ```typescript
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;
    
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return null;
    
    const isOwner = await isBusinessOwner(ctx, conversation.businessId);
    if (!isOwner) return null;
    
    // ... rest of existing handler
  }
  ```

  **Must NOT do**:
  - Do NOT modify internal mutations in these files
  - Do NOT change existing auth patterns in other functions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Two files, two different patterns (action vs query)
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 4, 5, 7)
  - **Blocks**: Tasks 12, 13
  - **Blocked By**: Task 1

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/integrations/whatsapp/settings.ts:6-30` - getConnectionStatus query shows auth pattern for this file
  - `packages/backend/convex/integrations/whatsapp/settings.ts:58-90` - saveCredentials mutation shows auth pattern
  - `packages/backend/convex/conversations.ts:16-24` - Query auth pattern returning null on failure
  - `packages/backend/convex/lib/auth.ts:5-10` - getAuthUser and isBusinessOwner helpers

  **Files to Modify**:
  - `packages/backend/convex/integrations/whatsapp/settings.ts:156` - testConnection action
  - `packages/backend/convex/messages.ts:131-149` - findMessageByContent query

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify auth in testConnection:
  grep -A10 "export const testConnection" packages/backend/convex/integrations/whatsapp/settings.ts | grep -c "authUser\|safeGetAuthUser"
  # Assert: At least 1 match
  
  # Verify auth in findMessageByContent:
  grep -A10 "export const findMessageByContent" packages/backend/convex/messages.ts | grep -c "getAuthUser\|authUser"
  # Assert: At least 1 match
  ```

  **Commit**: YES
  - Message: `fix(backend): add auth to whatsapp testConnection and messages findMessageByContent`
  - Files: `packages/backend/convex/integrations/whatsapp/settings.ts`, `packages/backend/convex/messages.ts`
  - Pre-commit: `bun run check-types`

---

- [ ] 7. Add auth to conversations.ts addMessage mutation (NEW - From Momus Review)

  **What to do**:
  - Locate `addMessage` mutation (around line 298)
  - Add authentication check at the start of the handler:
  ```typescript
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    
    const business = await ctx.db.get(conversation.businessId);
    if (!business || business.ownerId !== authUser._id) {
      throw new Error("Not authorized");
    }
    
    // ... rest of existing handler
  }
  ```

  **Why this is needed**:
  - Currently, `addMessage` has ZERO authentication
  - Anyone can add messages to any conversation
  - This is a security vulnerability

  **Must NOT do**:
  - Do NOT refactor to use helpers yet (that's Task 10)
  - Do NOT modify other functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single function modification
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 4, 5, 6)
  - **Blocks**: Tasks 10, 13
  - **Blocked By**: Task 1

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/conversations.ts:268-280` - `create` mutation shows the correct auth pattern
  - `packages/backend/convex/lib/auth.ts:5-10` - getAuthUser helper

  **File to Modify**:
  - `packages/backend/convex/conversations.ts:298-326` - addMessage mutation

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify auth added:
  grep -A15 "export const addMessage" packages/backend/convex/conversations.ts | grep -c "getAuthUser\|authUser\|Not authenticated"
  # Assert: At least 1 match
  ```

  **Commit**: YES
  - Message: `fix(backend): add auth check to conversations.ts addMessage mutation`
  - Files: `packages/backend/convex/conversations.ts`
  - Pre-commit: `bun run check-types`

---

### Wave 2: Type Fix

- [ ] 8. Fix products.ts businessId type and refactor 7 manual checks

  **What to do**:
  
  **Part A - Fix type** (enables helper usage):
  - Change all `businessId: v.string()` to `businessId: v.id("businesses")` in args
  - Update handler code to use `ctx.db.get(args.businessId)` instead of `.query().filter()`
  - Locations: create, list mutations at minimum

  **Part B - Refactor 7 manual checks**:
  Replace this pattern:
  ```typescript
  const authUser = await requireAuth(ctx);
  const business = await ctx.db
    .query("businesses")
    .filter((q) => q.eq(q.field("_id"), args.businessId))
    .first();
  if (!business) {
    throw new Error("Business not found");
  }
  if (business.ownerId !== authUser._id) {
    throw new Error("Not authorized to [ACTION] for this business");
  }
  ```
  
  With this pattern:
  ```typescript
  const { user, business } = await requireBusinessOwnership(ctx, args.businessId);
  ```

  **Functions to refactor**:
  1. `create` (lines 14-28)
  2. `update` (lines 74-92)
  3. `deleteProduct` (lines 114-132)
  4. `list` (lines 185-201) - Note: queries should use getAuthUser + isBusinessOwner, not requireBusinessOwnership
  5. `bulkUpdateAvailability` (lines 272-294)
  6. `bulkDelete` (lines 313-335)
  7. `bulkUpdateCategory` (lines 355-377)

  **Must NOT do**:
  - Do NOT change the function signatures or return types
  - Do NOT modify error messages (keep them consistent)
  - Do NOT change the list query to throw - keep returning empty on auth failure

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Multiple functions to modify, type changes, refactoring
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Tasks 9, 10, 11, 12
  - **Blocked By**: Tasks 3, 4, 5, 6, 7

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/businesses.ts:70-95` - `update` mutation shows correct requireBusinessOwnership usage
  - `packages/backend/convex/businesses.ts:48-67` - `list` query shows correct getAuthUser pattern
  - `packages/backend/convex/lib/auth.ts:23-32` - requireBusinessOwnership returns { user, business }

  **Type References**:
  - `packages/backend/convex/orders.ts:24` - Shows correct `businessId: v.id("businesses")` pattern
  - `packages/backend/convex/customers.ts:133` - Another example of correct type

  **Files to Modify**:
  - `packages/backend/convex/products.ts` - All 7 functions listed above

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify type changed:
  grep 'businessId: v.string()' packages/backend/convex/products.ts
  # Assert: No matches (all changed to v.id)
  
  # Verify using helpers:
  grep -c "requireBusinessOwnership" packages/backend/convex/products.ts
  # Assert: At least 6 matches (mutations)
  
  # Verify no manual pattern remains:
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/products.ts
  # Assert: 0 matches
  ```

  **Commit**: YES
  - Message: `refactor(backend): use auth helpers in products.ts and fix businessId type`
  - Files: `packages/backend/convex/products.ts`
  - Pre-commit: `bun run check-types`

---

### Wave 3: Refactor Manual Checks (Parallel)

- [ ] 9. Refactor customers.ts 8 manual checks

  **What to do**:
  - Replace 8 manual auth + ownership check patterns with helpers
  - Queries (get, getByPhone, list, getContext) should use `getAuthUser()` + `isBusinessOwner()`
  - Mutations (create, update, deleteCustomer, anonymize) should use `requireBusinessOwnership()`

  **Pattern for queries** (return null on failure):
  ```typescript
  const authUser = await getAuthUser(ctx);
  if (!authUser) return null;
  
  const isOwner = await isBusinessOwner(ctx, args.businessId);
  if (!isOwner) return null;
  ```

  **Pattern for mutations** (throw on failure):
  ```typescript
  const { user, business } = await requireBusinessOwnership(ctx, args.businessId);
  ```

  **Functions to refactor**:
  1. `get` query (line 10-21)
  2. `getByPhone` query (line 35-41)
  3. `list` query (line 73-79)
  4. `create` mutation (line 137-146) 
  5. `update` mutation (line 184-196)
  6. `getContext` query (line 216-227)
  7. `deleteCustomer` mutation (line 465-477)
  8. `anonymize` mutation (line 532-544)

  **Must NOT do**:
  - Do NOT modify updateStats (already fixed in Task 4)
  - Do NOT modify internal functions
  - Do NOT change return types or error behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Repetitive pattern replacement, helpers already imported
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 12)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 4, 8

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/lib/auth.ts:5-21` - getAuthUser, isBusinessOwner implementations
  - `packages/backend/convex/lib/auth.ts:23-32` - requireBusinessOwnership implementation
  - `packages/backend/convex/businesses.ts:48-67` - Query pattern with getAuthUser

  **File to Modify**:
  - `packages/backend/convex/customers.ts` - All 8 functions listed

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify no manual pattern remains:
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/customers.ts
  # Assert: 0 matches
  
  # Verify using helpers:
  grep -c "requireBusinessOwnership\|isBusinessOwner" packages/backend/convex/customers.ts
  # Assert: At least 8 matches
  ```

  **Commit**: YES
  - Message: `refactor(backend): use auth helpers in customers.ts`
  - Files: `packages/backend/convex/customers.ts`
  - Pre-commit: `bun run check-types`

---

- [ ] 10. Refactor conversations.ts 9 manual checks (UPDATED - From Momus Review)

  **What to do**:
  - Change import from `import { authComponent } from "./auth";` to `import { getAuthUser, requireAuth, isBusinessOwner, requireBusinessOwnership } from "./lib/auth";`
  - Replace 9 manual patterns using `authComponent.safeGetAuthUser(ctx)` with helpers

  **Functions to refactor (9 total)**:
  
  **Queries (4) - use getAuthUser + isBusinessOwner, return null/empty on failure**:
  1. `list` query (lines 16-24)
  2. `listByCustomer` query (lines 104-116)
  3. `get` query (lines 136-148)
  4. `messages` query (lines 172-184)

  **Mutations (5) - use requireAuth + requireBusinessOwnership, throw on failure**:
  5. `create` mutation (lines 268-280)
  6. `takeOver` mutation (lines 333-346)
  7. `handBack` mutation (lines 382-396)
  8. `close` mutation (lines 413-426)
  9. `reopen` mutation (lines 447-460)

  **Pattern for queries** (return null/empty on failure):
  ```typescript
  const authUser = await getAuthUser(ctx);
  if (!authUser) return null; // or empty array
  
  const isOwner = await isBusinessOwner(ctx, businessId);
  if (!isOwner) return null;
  ```

  **Pattern for mutations** (throw on failure):
  ```typescript
  const { user, business } = await requireBusinessOwnership(ctx, businessId);
  ```

  **Special case: takeOver and handBack**:
  - `takeOver`: Needs business ownership check via conversation.businessId
  - `handBack`: Only needs auth (already checks assignedTo === userId)

  **Must NOT do**:
  - Do NOT modify addMessage (already fixed in Task 7)
  - Do NOT modify internal functions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 9 functions to refactor, import changes, multiple patterns
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 11, 12)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 7, 8

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/lib/auth.ts:5-32` - All helper implementations
  - `packages/backend/convex/customers.ts` - Similar query and mutation patterns (after Task 9)

  **File to Modify**:
  - `packages/backend/convex/conversations.ts` - Import + 9 functions

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify import changed:
  grep 'from "./lib/auth"' packages/backend/convex/conversations.ts
  # Assert: 1 match
  
  # Verify no direct authComponent usage:
  grep -c "authComponent.safeGetAuthUser" packages/backend/convex/conversations.ts
  # Assert: 0 matches
  
  # Verify using helpers:
  grep -c "getAuthUser\|isBusinessOwner\|requireBusinessOwnership" packages/backend/convex/conversations.ts
  # Assert: At least 9 matches
  ```

  **Commit**: YES
  - Message: `refactor(backend): use auth helpers in conversations.ts`
  - Files: `packages/backend/convex/conversations.ts`
  - Pre-commit: `bun run check-types`

---

- [ ] 11. Refactor shopify.ts 3 manual checks

  **What to do**:
  - Add import: `import { getAuthUser, requireBusinessOwnership, isBusinessOwner } from "./lib/auth";`
  - Keep the `authComponent` import (still needed for verifyBusinessOwnership internal query)
  - Refactor 3 manual auth patterns to use helpers

  **Functions to refactor**:
  1. `getAuthUrl` mutation (lines 48-59) - Use `requireBusinessOwnership`
  2. `getConnectionStatus` query (lines 809-817) - Use `getAuthUser` + `isBusinessOwner`
  3. `verifyBusinessOwnership` internal query (lines 1196-1208) - Keep as-is (it's internal and used by actions)

  **Actually only 2 need refactoring** (verifyBusinessOwnership is internal and should stay as-is):
  1. `getAuthUrl` mutation → `requireBusinessOwnership`
  2. `getConnectionStatus` query → `getAuthUser` + `isBusinessOwner`

  **Must NOT do**:
  - Do NOT remove authComponent import entirely (still needed for verifyBusinessOwnership internal query)
  - Do NOT modify importProducts/createOrder (already fixed in Task 5)
  - Do NOT change internal actions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 2 functions to refactor with clear patterns
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 12)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 5, 8

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/lib/auth.ts:23-32` - requireBusinessOwnership for mutations
  - `packages/backend/convex/businesses.ts:70-95` - Mutation pattern with requireBusinessOwnership
  - `packages/backend/convex/businesses.ts:48-67` - Query pattern with getAuthUser

  **File to Modify**:
  - `packages/backend/convex/shopify.ts` - Import + 2 functions

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify lib/auth import added:
  grep 'from "./lib/auth"' packages/backend/convex/shopify.ts
  # Assert: 1 match
  
  # Verify using helpers in public functions:
  grep -c "requireBusinessOwnership\|isBusinessOwner" packages/backend/convex/shopify.ts
  # Assert: At least 2 matches (may be more from Task 5)
  ```

  **Commit**: YES
  - Message: `refactor(backend): use auth helpers in shopify.ts`
  - Files: `packages/backend/convex/shopify.ts`
  - Pre-commit: `bun run check-types`

---

- [ ] 12. Refactor whatsapp/settings.ts 2 manual checks

  **What to do**:
  - Change import from `import { authComponent } from "../../auth";` to `import { getAuthUser, requireAuth, isBusinessOwner, requireBusinessOwnership } from "../../lib/auth";`
  - Refactor 2 manual auth patterns to use helpers

  **Functions to refactor**:
  1. `getConnectionStatus` query (lines 11-21) - Use `getAuthUser` + `isBusinessOwner`
  2. `saveCredentials` mutation (lines 69-79) - Use `requireBusinessOwnership`

  **Must NOT do**:
  - Do NOT modify testConnection (already fixed in Task 6)
  - Do NOT modify internal functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 2 functions, simple import change + pattern replacement
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11)
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 6, 8

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/lib/auth.ts:5-32` - All helper implementations
  - `packages/backend/convex/businesses.ts:48-95` - Query and mutation patterns

  **File to Modify**:
  - `packages/backend/convex/integrations/whatsapp/settings.ts` - Import + 2 functions

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify import changed:
  grep 'from "../../lib/auth"' packages/backend/convex/integrations/whatsapp/settings.ts
  # Assert: 1 match
  
  # Verify no direct authComponent usage:
  grep -c "authComponent.safeGetAuthUser" packages/backend/convex/integrations/whatsapp/settings.ts
  # Assert: 0 matches
  ```

  **Commit**: YES
  - Message: `refactor(backend): use auth helpers in whatsapp/settings.ts`
  - Files: `packages/backend/convex/integrations/whatsapp/settings.ts`
  - Pre-commit: `bun run check-types`

---

### Wave 4: Final Verification

- [ ] 13. Final verification and cleanup

  **What to do**:
  
  **Part A - TypeScript Compilation**:
  ```bash
  bun run check-types
  ```
  Must exit with code 0, no errors.

  **Part B - Verify no manual patterns remain**:
  ```bash
  # Check for direct authComponent usage outside lib/auth.ts:
  grep -r "authComponent.safeGetAuthUser" packages/backend/convex/*.ts | grep -v "lib/auth.ts"
  # Should return no matches (except shopify.ts verifyBusinessOwnership which is internal)
  
  # Check for manual ownership pattern:
  grep -r "business.ownerId !== authUser._id" packages/backend/convex/
  # Should return no matches
  ```

  **Part C - Verify AI functionality preserved**:
  ```bash
  # Verify AI uses internal mutations:
  grep -c "internal.orders" packages/backend/convex/ai/agent.ts
  # Should return at least 3 matches
  
  grep -c "internal.orders" packages/backend/convex/ai/process.ts
  # Should return at least 3 matches
  ```

  **Part D - Verify all public functions have auth**:
  - Manually review each file to ensure:
    - All public mutations use `requireAuth()` or `requireBusinessOwnership()`
    - All public queries use `getAuthUser()` or `isBusinessOwner()`
    - Internal functions are unchanged (no auth needed)

  **Part E - LSP Diagnostics**:
  Run LSP diagnostics on all modified files to ensure no errors.

  **Must NOT do**:
  - Do NOT make any code changes in this task
  - Do NOT skip any verification step

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification only, no code changes
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final, sequential)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 9, 10, 11, 12

  **References**:
  
  **Files to Verify**:
  - `packages/backend/convex/messages.ts`
  - `packages/backend/convex/shopify.ts`
  - `packages/backend/convex/orders.ts`
  - `packages/backend/convex/customers.ts`
  - `packages/backend/convex/products.ts`
  - `packages/backend/convex/conversations.ts`
  - `packages/backend/convex/integrations/whatsapp/settings.ts`
  - `packages/backend/convex/ai/agent.ts`
  - `packages/backend/convex/ai/process.ts`

  **Acceptance Criteria**:

  ```bash
  # Full type check:
  bun run check-types
  # Assert: Exit code 0
  
  # No direct authComponent usage in main files (except internal queries):
  grep -r "authComponent.safeGetAuthUser" packages/backend/convex/*.ts | grep -v "lib/auth.ts" | grep -v "verifyBusinessOwnership" | wc -l
  # Assert: 0
  
  # No manual ownership checks:
  grep -r "business.ownerId !== authUser._id" packages/backend/convex/ | wc -l
  # Assert: 0
  
  # AI uses internal mutations:
  grep -c "internal.orders" packages/backend/convex/ai/agent.ts
  # Assert: >= 3
  
  # Biome check (optional):
  bun run check
  # Assert: Exit code 0
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1, 2 | `fix(backend): add missing auth imports in messages.ts and shopify.ts` | messages.ts, shopify.ts | bun run check-types |
| 3 | `fix(backend): add auth to orders.ts and create internal mutations for AI` | orders.ts, ai/agent.ts, ai/process.ts | bun run check-types |
| 4 | `fix(backend): add auth check to customers.ts updateStats mutation` | customers.ts | bun run check-types |
| 5 | `fix(backend): add auth checks to shopify.ts importProducts and createOrder` | shopify.ts | bun run check-types |
| 6 | `fix(backend): add auth to whatsapp testConnection and messages findMessageByContent` | settings.ts, messages.ts | bun run check-types |
| 7 | `fix(backend): add auth check to conversations.ts addMessage mutation` | conversations.ts | bun run check-types |
| 8 | `refactor(backend): use auth helpers in products.ts and fix businessId type` | products.ts | bun run check-types |
| 9 | `refactor(backend): use auth helpers in customers.ts` | customers.ts | bun run check-types |
| 10 | `refactor(backend): use auth helpers in conversations.ts` | conversations.ts | bun run check-types |
| 11 | `refactor(backend): use auth helpers in shopify.ts` | shopify.ts | bun run check-types |
| 12 | `refactor(backend): use auth helpers in whatsapp/settings.ts` | settings.ts | bun run check-types |

---

## Success Criteria

### Verification Commands
```bash
# TypeScript compilation
bun run check-types
# Expected: Exit code 0, no errors

# No direct authComponent usage (except internal queries)
grep -r "authComponent.safeGetAuthUser" packages/backend/convex/*.ts | grep -v "lib/auth.ts" | grep -v "verifyBusinessOwnership"
# Expected: No output

# No manual ownership checks
grep -r "business.ownerId !== authUser._id" packages/backend/convex/
# Expected: No output

# AI uses internal mutations
grep -c "internal.orders" packages/backend/convex/ai/agent.ts
# Expected: >= 3

# Biome lint/format
bun run check
# Expected: Exit code 0
```

### Final Checklist
- [ ] All broken imports fixed (messages.ts, shopify.ts)
- [ ] All security gaps fixed (16 mutations/queries now have auth)
- [ ] All manual checks refactored (30 instances)
- [ ] Internal mutations created for AI-called operations (3 in orders.ts)
- [ ] AI callers updated to use internal mutations (agent.ts, process.ts)
- [ ] products.ts uses v.id("businesses") type
- [ ] TypeScript compilation passes
- [ ] No direct authComponent usage outside lib/auth.ts (except internal queries)
- [ ] No manual business.ownerId checks remain
- [ ] AI agent functionality preserved
