# S03: Use Shared Auth Utilities - Parallel Execution Plan

## TL;DR

> **Quick Summary**: Refactor 10 backend Convex files to replace ~30 manual auth ownership checks with shared helpers from `lib/auth.ts`. Most files can be refactored in parallel since they're independent.
> 
> **Deliverables**:
> - 10 files refactored to use `isBusinessOwner()` for queries and `requireBusinessOwnership()` for mutations
> - Missing imports added to broken files (customerAddresses.ts, deletionRequests.ts)
> - TypeScript compilation passes
> - All existing functionality preserved
> 
> **Estimated Effort**: Medium (2-3 hours with parallel execution)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Wave 1 (fix imports) → Wave 2 (main refactoring) → Wave 3 (verification)

---

## Context

### Original Request
S03 User Story: Replace 50+ manual auth checks with shared auth utilities from `lib/auth.ts`.

### Current State Analysis

**Auth Helpers Available** (`packages/backend/convex/lib/auth.ts`):
- `getAuthUser(ctx)` - Returns user or null, no throw
- `requireAuth(ctx)` - Throws "Not authenticated" if not auth
- `isBusinessOwner(ctx, businessId)` - Returns boolean (for queries)
- `requireBusinessOwnership(ctx, businessId)` - Throws if not owner, returns {user, business} (for mutations)

**Files Already Done (SKIP)**:
- businesses.ts (line 145 only needs fix)
- products.ts, orders.ts, conversations.ts, categories.ts, customerMemory.ts

**Files Needing Work**:
| File | Manual Checks | Issue |
|------|---------------|-------|
| customerAddresses.ts | 3 + broken imports | Uses functions without importing them! |
| deletionRequests.ts | 3 + broken imports | Uses `isBusinessOwner` without importing |
| customers.ts | 4 | Manual checks in queries |
| customerNotes.ts | 4 | Manual checks in mutations |
| conversationSummaries.ts | 4 | Manual checks in queries |
| dashboard.ts | 2 | Manual checks in queries |
| ai/settings.ts | 2 | Manual checks in queries |
| businesses.ts | 1 | Line 145 only |
| integrations/meta/actions.ts | 2 | Manual checks in internal queries |

### Research Findings

**Pattern for Queries (return null/empty on failure)**:
```typescript
// BEFORE (manual)
const business = await ctx.db.get(args.businessId);
if (!business || business.ownerId !== authUser._id) {
    return null;
}

// AFTER (helper)
const isOwner = await isBusinessOwner(ctx, args.businessId);
if (!isOwner) {
    return null;
}
```

**Pattern for Mutations (throw on failure)**:
```typescript
// BEFORE (manual)
const authUser = await getAuthUser(ctx);
if (!authUser) throw new Error("Not authenticated");
const business = await ctx.db.get(customer.businessId);
if (!business || business.ownerId !== authUser._id) {
    throw new Error("Not authorized");
}

// AFTER (helper)
await requireBusinessOwnership(ctx, customer.businessId);
```

---

## Work Objectives

### Core Objective
Replace manual `business.ownerId !== authUser._id` checks with `isBusinessOwner()` helper for queries and `requireBusinessOwnership()` for mutations, ensuring consistent auth patterns across the codebase.

### Concrete Deliverables
- 10 files updated with proper auth helper usage
- 2 files with missing imports fixed (customerAddresses.ts, deletionRequests.ts)
- ~30 manual auth checks replaced
- TypeScript compilation succeeds (`bun run check-types`)

### Definition of Done
- [ ] `bun run check-types` passes with no errors
- [ ] All replaced checks use appropriate helper (isBusinessOwner for queries, requireBusinessOwnership for mutations)
- [ ] No regressions in auth behavior (queries return null/empty, mutations throw)

### Must Have
- Backward compatibility - queries return null/empty on auth failure
- Error messages preserved where specified
- All imports properly added

### Must NOT Have (Guardrails)
- DO NOT change auth behavior (queries should NOT start throwing)
- DO NOT modify internal functions (internalMutation, internalQuery) - they intentionally skip auth
- DO NOT refactor notifications.ts - it uses userId-based auth, not business ownership
- DO NOT touch messages.ts line 21 - `assignedTo` check is conversation assignment, not business ownership

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (no test framework configured)
- **User wants tests**: Manual-only
- **QA approach**: TypeScript compilation + manual verification

### Verification Commands
```bash
# Primary verification
bun run check-types

# Secondary verification  
bun run check
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Critical Fixes - Start Immediately):
├── Task 1: Fix customerAddresses.ts broken imports
└── Task 2: Fix deletionRequests.ts broken imports

Wave 2 (Main Refactoring - After Wave 1):
├── Task 3: Refactor customers.ts (4 manual checks)
├── Task 4: Refactor customerNotes.ts (4 manual checks)
├── Task 5: Refactor conversationSummaries.ts (4 manual checks)
├── Task 6: Refactor dashboard.ts (2 manual checks)
├── Task 7: Refactor ai/settings.ts (2 manual checks)
├── Task 8: Fix businesses.ts line 145
├── Task 9: Refactor customerAddresses.ts manual checks (3 checks)
└── Task 10: Refactor deletionRequests.ts manual checks (2 checks)

Wave 3 (Integration - After Wave 2):
├── Task 11: Refactor integrations/meta/actions.ts (2 checks)
└── Task 12: Final verification (type check + lint)

Critical Path: Task 1 → Task 9 → Task 12
Parallel Speedup: ~60% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 9 | 2 |
| 2 | None | 10 | 1 |
| 3 | None | 12 | 4, 5, 6, 7, 8 |
| 4 | None | 12 | 3, 5, 6, 7, 8 |
| 5 | None | 12 | 3, 4, 6, 7, 8 |
| 6 | None | 12 | 3, 4, 5, 7, 8 |
| 7 | None | 12 | 3, 4, 5, 6, 8 |
| 8 | None | 12 | 3, 4, 5, 6, 7 |
| 9 | 1 | 12 | 10, 3, 4, 5, 6, 7, 8 |
| 10 | 2 | 12 | 9, 3, 4, 5, 6, 7, 8 |
| 11 | None | 12 | 3-10 |
| 12 | 3-11 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2 | Parallel - 2 quick agents |
| 2 | 3-11 | Parallel - 9 quick agents |
| 3 | 12 | Sequential - 1 agent for verification |

---

## TODOs

### Wave 1: Critical Import Fixes

- [ ] 1. Fix customerAddresses.ts - Add Missing Imports

  **What to do**:
  - Add import statement at top of file:
    ```typescript
    import { getAuthUser, requireAuth, isBusinessOwner, requireBusinessOwnership } from "./lib/auth";
    ```
  - File currently CALLS these functions without importing them - runtime error waiting to happen

  **Must NOT do**:
  - Do not change any function logic yet (that's Task 9)
  - Do not remove any existing code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line change, no complex logic
  - **Skills**: []
    - No special skills needed for import addition

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/customerAddresses.ts:1-3` - Current imports (missing auth imports)
  - `packages/backend/convex/lib/auth.ts` - Export signatures to import
  - `packages/backend/convex/customers.ts:3` - Example of correct import pattern

  **Acceptance Criteria**:
  ```bash
  # Agent runs:
  grep -n "import.*from.*lib/auth" packages/backend/convex/customerAddresses.ts
  # Assert: Returns line with import statement including getAuthUser, isBusinessOwner
  
  bun run check-types 2>&1 | grep -c "customerAddresses"
  # Assert: Returns 0 (no type errors in this file)
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `fix(backend): add missing auth imports to customerAddresses and deletionRequests`
  - Files: `packages/backend/convex/customerAddresses.ts`, `packages/backend/convex/deletionRequests.ts`


- [ ] 2. Fix deletionRequests.ts - Add Missing Imports

  **What to do**:
  - Update import statement to include `isBusinessOwner`:
    ```typescript
    import { getAuthUser, isBusinessOwner } from "./lib/auth";
    ```
  - Line 11 calls `isBusinessOwner()` without importing it

  **Must NOT do**:
  - Do not change function logic yet (that's Task 10)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line import fix
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 10
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/deletionRequests.ts:3` - Current import (only has getAuthUser)
  - `packages/backend/convex/deletionRequests.ts:11` - Uses isBusinessOwner without import

  **Acceptance Criteria**:
  ```bash
  # Agent runs:
  grep "isBusinessOwner" packages/backend/convex/deletionRequests.ts | head -1
  # Assert: First match is import statement, not function call
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `fix(backend): add missing auth imports to customerAddresses and deletionRequests`


### Wave 2: Main File Refactoring (Parallel)

- [ ] 3. Refactor customers.ts - Replace 4 Manual Checks

  **What to do**:
  - Import `isBusinessOwner` (already imports `getAuthUser`, `requireBusinessOwnership`)
  - Replace manual checks in 4 queries:
    - Line 20-22 (`get` query): Replace business fetch + manual check with `isBusinessOwner(ctx, customer.businessId)`
    - Line 40-42 (`getByPhone` query): Replace with `isBusinessOwner(ctx, args.businessId)`
    - Line 78-80 (`list` query): Replace with `isBusinessOwner(ctx, args.businessId)`
    - Line 208-210 (`getContext` query): Replace with `isBusinessOwner(ctx, customer.businessId)`

  **Pattern to Apply**:
  ```typescript
  // BEFORE (lines 20-22 in get query)
  const business = await ctx.db.get(customer.businessId);
  if (!business || business.ownerId !== authUser._id) {
      return null;
  }
  
  // AFTER
  const isOwner = await isBusinessOwner(ctx, customer.businessId);
  if (!isOwner) {
      return null;
  }
  ```

  **Must NOT do**:
  - Do not change mutations (create, update, updateStats, deleteCustomer, anonymize) - they already use `requireBusinessOwnership`
  - Do not touch internal functions (getOrCreate, getContextInternal, updateStatsInternal)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical pattern replacement, 4 similar changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4-11)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/customers.ts:3` - Current imports
  - `packages/backend/convex/customers.ts:20-22` - get query manual check
  - `packages/backend/convex/customers.ts:40-42` - getByPhone query manual check
  - `packages/backend/convex/customers.ts:78-80` - list query manual check
  - `packages/backend/convex/customers.ts:208-210` - getContext query manual check
  - `packages/backend/convex/lib/auth.ts:46-58` - isBusinessOwner implementation

  **Acceptance Criteria**:
  ```bash
  # Agent runs:
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/customers.ts
  # Assert: Returns 0 (no manual checks remaining)
  
  grep -c "isBusinessOwner" packages/backend/convex/customers.ts
  # Assert: Returns 5 (1 import + 4 usages)
  
  bun run check-types 2>&1 | grep -c "customers.ts"
  # Assert: Returns 0 (no type errors)
  ```

  **Commit**: YES
  - Message: `refactor(backend): use isBusinessOwner helper in customers.ts queries`
  - Files: `packages/backend/convex/customers.ts`


- [ ] 4. Refactor customerNotes.ts - Replace 4 Manual Checks

  **What to do**:
  - Add `isBusinessOwner` and `requireBusinessOwnership` to imports
  - Replace manual checks:
    - Line 20-22 (`list` query): Use `isBusinessOwner`
    - Line 48-54 (`add` mutation): Use `requireBusinessOwnership(ctx, customer.businessId)` - simplifies to one line
    - Line 91-97 (`update` mutation): Use `requireBusinessOwnership`
    - Line 132-138 (`deleteNote` mutation): Use `requireBusinessOwnership`

  **Pattern for Mutations**:
  ```typescript
  // BEFORE (lines 48-54 in add mutation)
  const business = await ctx.db.get(customer.businessId);
  if (!business) {
      throw new Error("Business not found");
  }
  if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to add notes for this customer");
  }
  
  // AFTER
  await requireBusinessOwnership(ctx, customer.businessId);
  // Note: Error messages will change to standardized ones from helper
  ```

  **Must NOT do**:
  - Do not preserve custom error messages (standardization is acceptable)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 4 mechanical replacements
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/customerNotes.ts:1-3` - Imports
  - `packages/backend/convex/customerNotes.ts:20-22` - list query
  - `packages/backend/convex/customerNotes.ts:48-54` - add mutation
  - `packages/backend/convex/customerNotes.ts:91-97` - update mutation
  - `packages/backend/convex/customerNotes.ts:132-138` - deleteNote mutation

  **Acceptance Criteria**:
  ```bash
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/customerNotes.ts
  # Assert: Returns 0
  
  grep -c "requireBusinessOwnership\|isBusinessOwner" packages/backend/convex/customerNotes.ts
  # Assert: Returns 5 (1 import line + 4 usages)
  ```

  **Commit**: YES
  - Message: `refactor(backend): use auth helpers in customerNotes.ts`
  - Files: `packages/backend/convex/customerNotes.ts`


- [ ] 5. Refactor conversationSummaries.ts - Replace 4 Manual Checks

  **What to do**:
  - Add `isBusinessOwner`, `requireBusinessOwnership` to imports
  - Replace manual checks:
    - Line 20-22 (`get` query): Use `isBusinessOwner(ctx, conversation.businessId)`
    - Line 48-50 (`listByCustomer` query): Use `isBusinessOwner(ctx, customer.businessId)`
    - Line 82-84 (`search` query): Use `isBusinessOwner(ctx, customer.businessId)`
    - Lines 116-132 (`create` mutation): Use `requireBusinessOwnership(ctx, conversation.businessId)`

  **Must NOT do**:
  - Do not touch `createInternal` (internalMutation - no auth needed)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 4 mechanical replacements
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/conversationSummaries.ts:1-3` - Imports
  - `packages/backend/convex/conversationSummaries.ts:20-22` - get query
  - `packages/backend/convex/conversationSummaries.ts:48-50` - listByCustomer query
  - `packages/backend/convex/conversationSummaries.ts:82-84` - search query
  - `packages/backend/convex/conversationSummaries.ts:116-132` - create mutation

  **Acceptance Criteria**:
  ```bash
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/conversationSummaries.ts
  # Assert: Returns 0
  ```

  **Commit**: YES
  - Message: `refactor(backend): use auth helpers in conversationSummaries.ts`
  - Files: `packages/backend/convex/conversationSummaries.ts`


- [ ] 6. Refactor dashboard.ts - Replace 2 Manual Checks

  **What to do**:
  - Add `isBusinessOwner` to imports
  - Replace manual checks:
    - Line 15-17 (`getMetrics` query): Use `isBusinessOwner(ctx, args.businessId)`
    - Line 102-104 (`getActivity` query): Use `isBusinessOwner(ctx, args.businessId)`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 2 simple replacements
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/dashboard.ts:1-3` - Imports
  - `packages/backend/convex/dashboard.ts:15-17` - getMetrics query
  - `packages/backend/convex/dashboard.ts:102-104` - getActivity query

  **Acceptance Criteria**:
  ```bash
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/dashboard.ts
  # Assert: Returns 0
  
  grep -c "isBusinessOwner" packages/backend/convex/dashboard.ts
  # Assert: Returns 3 (1 import + 2 usages)
  ```

  **Commit**: YES
  - Message: `refactor(backend): use isBusinessOwner in dashboard.ts`
  - Files: `packages/backend/convex/dashboard.ts`


- [ ] 7. Refactor ai/settings.ts - Replace 2 Manual Checks

  **What to do**:
  - Add `isBusinessOwner` to imports (already has `getAuthUser`, `requireBusinessOwnership`)
  - Replace manual checks:
    - Line 26-28 (`getSettings` query): Use `isBusinessOwner(ctx, args.businessId)`
    - Line 69-71 (`getUsageStats` query): Use `isBusinessOwner(ctx, args.businessId)`

  **Must NOT do**:
  - Do not change `updateSettings` mutation - already uses `requireBusinessOwnership`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 2 simple replacements
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/ai/settings.ts:3` - Imports
  - `packages/backend/convex/ai/settings.ts:26-28` - getSettings query
  - `packages/backend/convex/ai/settings.ts:69-71` - getUsageStats query

  **Acceptance Criteria**:
  ```bash
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/ai/settings.ts
  # Assert: Returns 0
  ```

  **Commit**: YES
  - Message: `refactor(backend): use isBusinessOwner in ai/settings.ts`
  - Files: `packages/backend/convex/ai/settings.ts`


- [ ] 8. Fix businesses.ts - Replace 1 Manual Check

  **What to do**:
  - Add `isBusinessOwner` to imports
  - Replace line 145 in `get` query:
    ```typescript
    // BEFORE
    if (!business || business.ownerId !== authUser._id) {
        return null;
    }
    
    // AFTER
    const isOwner = await isBusinessOwner(ctx, args.businessId);
    if (!isOwner) {
        return null;
    }
    ```
  - Note: Need to fetch business separately since isBusinessOwner only returns boolean

  **Alternative approach** (simpler):
  ```typescript
  const isOwner = await isBusinessOwner(ctx, args.businessId);
  if (!isOwner) {
      return null;
  }
  const business = await ctx.db.get(args.businessId);
  return business;
  ```

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single location change
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/businesses.ts:3` - Imports
  - `packages/backend/convex/businesses.ts:144-147` - get query manual check

  **Acceptance Criteria**:
  ```bash
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/businesses.ts
  # Assert: Returns 0
  ```

  **Commit**: YES
  - Message: `refactor(backend): use isBusinessOwner in businesses.ts get query`
  - Files: `packages/backend/convex/businesses.ts`


- [ ] 9. Refactor customerAddresses.ts - Replace 3 Manual Checks

  **What to do** (AFTER Task 1 adds imports):
  - Replace manual checks in mutations:
    - Lines 113-119 (`update` mutation): Use `requireBusinessOwnership`
    - Lines 168-174 (`deleteAddress` mutation): Use `requireBusinessOwnership`
    - Lines 203-209 (`setDefault` mutation): Use `requireBusinessOwnership`

  **Pattern**:
  ```typescript
  // BEFORE (update mutation lines 108-119)
  const customer = await ctx.db.get(addressRecord.customerId);
  if (!customer) { throw new Error("Customer not found"); }
  const business = await ctx.db.get(customer.businessId);
  if (!business) { throw new Error("Business not found"); }
  if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to update this address");
  }
  
  // AFTER
  const customer = await ctx.db.get(addressRecord.customerId);
  if (!customer) { throw new Error("Customer not found"); }
  await requireBusinessOwnership(ctx, customer.businessId);
  ```

  **Must NOT do**:
  - Do not change `list` query or `add` mutation - they already use `isBusinessOwner`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3 mechanical replacements
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 2 (with dependency)
  - **Blocks**: Task 12
  - **Blocked By**: Task 1 (must add imports first)

  **References**:
  - `packages/backend/convex/customerAddresses.ts:108-119` - update mutation
  - `packages/backend/convex/customerAddresses.ts:158-174` - deleteAddress mutation
  - `packages/backend/convex/customerAddresses.ts:193-209` - setDefault mutation

  **Acceptance Criteria**:
  ```bash
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/customerAddresses.ts
  # Assert: Returns 0
  
  grep -c "requireBusinessOwnership" packages/backend/convex/customerAddresses.ts
  # Assert: Returns 4 (1 import + 3 usages)
  ```

  **Commit**: YES
  - Message: `refactor(backend): use requireBusinessOwnership in customerAddresses.ts mutations`
  - Files: `packages/backend/convex/customerAddresses.ts`


- [ ] 10. Refactor deletionRequests.ts - Replace 2 Manual Checks

  **What to do** (AFTER Task 2 adds imports):
  - Add `requireBusinessOwnership` to imports (Task 2 only added `isBusinessOwner`)
  - Replace manual checks:
    - Lines 59-61 (`getPendingCount` query): Use `isBusinessOwner(ctx, args.businessId)`
    - Lines 119-121 (`approve` mutation): Use `requireBusinessOwnership(ctx, request.businessId)`
    - Lines 202-204 (`deny` mutation): Use `requireBusinessOwnership(ctx, request.businessId)`

  **Must NOT do**:
  - Do not change `list` query line 11 - already uses `isBusinessOwner`
  - Do not change `create` (internalMutation - no auth)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3 mechanical replacements + import update
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 2)
  - **Parallel Group**: Wave 2 (with dependency)
  - **Blocks**: Task 12
  - **Blocked By**: Task 2

  **References**:
  - `packages/backend/convex/deletionRequests.ts:3` - Imports
  - `packages/backend/convex/deletionRequests.ts:59-61` - getPendingCount query
  - `packages/backend/convex/deletionRequests.ts:119-121` - approve mutation
  - `packages/backend/convex/deletionRequests.ts:202-204` - deny mutation

  **Acceptance Criteria**:
  ```bash
  grep -c "business.ownerId !== authUser._id" packages/backend/convex/deletionRequests.ts
  # Assert: Returns 0
  ```

  **Commit**: YES
  - Message: `refactor(backend): use auth helpers in deletionRequests.ts`
  - Files: `packages/backend/convex/deletionRequests.ts`


- [ ] 11. Refactor integrations/meta/actions.ts - Replace 2 Manual Checks

  **What to do**:
  - The file has `verifyBusinessOwnership` internal query (lines 84-104) that does manual check
  - Also `getMessagingWindowStatus` query (lines 127-176) has manual check at line 151
  
  **Decision**: For `verifyBusinessOwnership` internal query:
  - This is intentionally an internal query used by actions that need to verify ownership
  - It returns `{ authorized: boolean; error?: string }` for actions to handle
  - KEEP AS IS - this is the helper pattern for actions

  **For `getMessagingWindowStatus` query** (line 151):
  - Replace with `isBusinessOwner(ctx, conversation.businessId)`
  - Add `isBusinessOwner` to imports

  **Must NOT do**:
  - Do not change `verifyBusinessOwnership` internal query - it serves actions
  - Do not change any other internal functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single replacement
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/integrations/meta/actions.ts:11` - Imports
  - `packages/backend/convex/integrations/meta/actions.ts:150-152` - getMessagingWindowStatus manual check
  - `packages/backend/convex/integrations/meta/actions.ts:84-104` - verifyBusinessOwnership (KEEP)

  **Acceptance Criteria**:
  ```bash
  # Check only the getMessagingWindowStatus function for manual checks
  grep -A 30 "getMessagingWindowStatus" packages/backend/convex/integrations/meta/actions.ts | grep -c "business.ownerId !== authUser._id"
  # Assert: Returns 0
  
  # Verify verifyBusinessOwnership still has its manual check (intentional)
  grep -A 20 "verifyBusinessOwnership" packages/backend/convex/integrations/meta/actions.ts | grep -c "business.ownerId !== authUser._id"
  # Assert: Returns 1 (intentionally kept)
  ```

  **Commit**: YES
  - Message: `refactor(backend): use isBusinessOwner in meta/actions getMessagingWindowStatus`
  - Files: `packages/backend/convex/integrations/meta/actions.ts`


### Wave 3: Final Verification

- [ ] 12. Final Verification - Type Check and Lint

  **What to do**:
  - Run full type check
  - Run linter
  - Verify no remaining manual ownership checks (excluding intentional ones)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification commands only
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None (completion)
  - **Blocked By**: Tasks 3-11

  **References**:
  - All files modified in previous tasks

  **Acceptance Criteria**:
  ```bash
  # Type check
  bun run check-types
  # Assert: Exit code 0
  
  # Lint check
  bun run check
  # Assert: Exit code 0
  
  # Count remaining manual checks (should only be in verifyBusinessOwnership internals)
  grep -r "business.ownerId !== authUser._id" packages/backend/convex/ --include="*.ts" | grep -v "verifyBusinessOwnership" | wc -l
  # Assert: Returns 0
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 1+2 | `fix(backend): add missing auth imports to customerAddresses and deletionRequests` | customerAddresses.ts, deletionRequests.ts |
| 3 | `refactor(backend): use isBusinessOwner helper in customers.ts queries` | customers.ts |
| 4 | `refactor(backend): use auth helpers in customerNotes.ts` | customerNotes.ts |
| 5 | `refactor(backend): use auth helpers in conversationSummaries.ts` | conversationSummaries.ts |
| 6 | `refactor(backend): use isBusinessOwner in dashboard.ts` | dashboard.ts |
| 7 | `refactor(backend): use isBusinessOwner in ai/settings.ts` | ai/settings.ts |
| 8 | `refactor(backend): use isBusinessOwner in businesses.ts get query` | businesses.ts |
| 9 | `refactor(backend): use requireBusinessOwnership in customerAddresses.ts mutations` | customerAddresses.ts |
| 10 | `refactor(backend): use auth helpers in deletionRequests.ts` | deletionRequests.ts |
| 11 | `refactor(backend): use isBusinessOwner in meta/actions getMessagingWindowStatus` | meta/actions.ts |

---

## Success Criteria

### Verification Commands
```bash
# Full verification suite
bun run check-types  # Expected: 0 errors
bun run check        # Expected: 0 errors

# Manual check audit
grep -r "business.ownerId !== authUser._id" packages/backend/convex/ --include="*.ts" | grep -v verifyBusinessOwnership
# Expected: No output (0 remaining manual checks outside intentional internals)

# Helper usage count
grep -r "isBusinessOwner\|requireBusinessOwnership" packages/backend/convex/ --include="*.ts" | wc -l
# Expected: 40+ lines (imports + usages)
```

### Final Checklist
- [ ] All "Must Have" present:
  - [ ] Backward compatibility maintained
  - [ ] All imports properly added
  - [ ] Queries return null/empty on auth failure
  - [ ] Mutations throw on auth failure
- [ ] All "Must NOT Have" absent:
  - [ ] No queries throwing on auth failure
  - [ ] No changes to internal functions
  - [ ] No changes to notifications.ts
  - [ ] No changes to messages.ts line 21
- [ ] All verification commands pass
