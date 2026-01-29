# S03: Use Shared Auth Utilities - Refactoring Plan

## TL;DR

> **Quick Summary**: Replace 51 manual auth patterns across 15 backend files with shared utilities from `lib/auth.ts`. This is a pure refactoring task - no behavior changes.
> 
> **Deliverables**:
> - 38 manual ownership checks → `requireBusinessOwnership()` or `isBusinessOwner()`
> - 2 direct authComponent calls → `getAuthUser()`
> - 11 inline auth throws → `requireAuth()`
> - All files pass TypeScript type-checking
> 
> **Estimated Effort**: Medium (15 files, ~51 replacements)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Wave 1 (high-impact files) → Wave 2 (medium files) → Wave 3 (verification)

---

## Context

### Original Request
Refactor backend Convex files to use shared auth utilities from `packages/backend/convex/lib/auth.ts` instead of manual auth patterns. Story S03 from PRD with priority 3.

### Interview Summary
**Key Decisions**:
- Use `isBusinessOwner()` for query soft-fail patterns (cleaner than try-catch)
- Use `requireBusinessOwnership()` for mutations that throw on auth failure
- Use `requireAuth()` to replace inline `throw new Error("Not authenticated")`
- Use `getAuthUser()` to replace direct `authComponent.safeGetAuthUser()` calls

**Research Findings**:
- 51 anti-patterns found across 15 files (excluding lib/auth.ts)
- `isBusinessOwner()` exists but is never used - this refactoring adopts it
- Some files already partially use utilities but inconsistently

### Self-Analysis (Metis-equivalent)
**Potential Gaps Addressed**:
1. **Indirect ownership chains**: Files like customerAddresses.ts check ownership via customer→business. These will keep manual business fetch but use `isBusinessOwner` for the actual ownership check.
2. **Error message consistency**: All auth errors will now use consistent messages from lib/auth.ts
3. **Import updates**: Each file needs correct imports added

---

## Work Objectives

### Core Objective
Replace all manual authentication and authorization patterns with shared utilities to improve consistency, maintainability, and reduce code duplication.

### Concrete Deliverables
- 15 files refactored to use shared auth utilities
- Zero manual `authComponent.safeGetAuthUser()` calls outside lib/auth.ts
- Zero inline `throw new Error("Not authenticated")` patterns
- Zero manual `business.ownerId !== authUser._id` checks

### Definition of Done
- [ ] `bun run check-types` passes with no errors
- [ ] `bun run check` (linter) passes
- [ ] All 51 anti-patterns replaced with utility calls
- [ ] No behavior changes (queries still return null/empty, mutations still throw)

### Must Have
- Preserve exact behavior (soft-fail for queries, hard-fail for mutations)
- Update imports in each file
- Handle indirect ownership chains correctly

### Must NOT Have (Guardrails)
- NO changes to lib/auth.ts (the source of utilities)
- NO changes to internalMutation/internalQuery functions (no auth needed)
- NO new helper functions - use existing utilities only
- NO changes to error messages (use what lib/auth.ts provides)
- NO refactoring beyond auth patterns (don't touch business logic)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (Vitest not configured)
- **User wants tests**: Manual verification via TypeScript compilation
- **Framework**: None currently
- **QA approach**: Automated verification via `bun run check-types` and `bun run check`

### Automated Verification (for each task)

```bash
# After each file refactor:
bun run check-types  # TypeScript compilation
bun run check        # Biome linter + formatter

# Final verification:
bun run build        # Full build to catch any issues
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately) - High Impact Files:
├── Task 1: customerAddresses.ts (9 patterns)
├── Task 2: customerNotes.ts (7 patterns)
├── Task 3: deletionRequests.ts (6 patterns)
├── Task 4: orders.ts (5 patterns)
└── Task 5: conversationSummaries.ts (5 patterns)

Wave 2 (After Wave 1) - Medium Impact Files:
├── Task 6: customers.ts (4 patterns)
├── Task 7: dashboard.ts (2 patterns)
├── Task 8: ai/settings.ts (2 patterns)
├── Task 9: products.ts (2 patterns)
├── Task 10: integrations/meta/actions.ts (2 patterns)
├── Task 11: integrations/whatsapp/settings.ts (2 patterns)
└── Task 12: shopify.ts (2 patterns)

Wave 3 (After Wave 2) - Low Impact + Verification:
├── Task 13: businesses.ts (1 pattern)
├── Task 14: categories.ts (1 pattern)
├── Task 15: customerMemory.ts (1 pattern)
└── Task 16: Final verification (type-check + lint)

Critical Path: Wave 1 → Wave 2 → Wave 3
Parallel Speedup: ~60% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1-5 | None | 16 | Each other (Wave 1) |
| 6-12 | None | 16 | Each other (Wave 2) |
| 13-15 | None | 16 | Each other (Wave 3) |
| 16 | 1-15 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1-5 | 5 parallel agents, category="quick", skills=[] |
| 2 | 6-12 | 7 parallel agents, category="quick", skills=[] |
| 3 | 13-16 | 4 parallel agents (3 refactor + 1 verification) |

---

## TODOs

### Wave 1: High Impact Files

- [ ] 1. Refactor customerAddresses.ts (9 patterns)

  **What to do**:
  - Update import: add `requireAuth`, `isBusinessOwner` to existing import from `./lib/auth`
  - Replace 4 inline auth throws (lines 48, 103, 158, 193) with `requireAuth(ctx)`
  - Replace 5 ownership checks (lines 21, 61, 121, 176, 211) with `isBusinessOwner()` for queries or `requireBusinessOwnership()` for mutations
  - Pattern for mutations (add, update, deleteAddress, setDefault):
    ```typescript
    // FROM
    const authUser = await getAuthUser(ctx);
    if (!authUser) { throw new Error("Not authenticated"); }
    // ... fetch customer, business ...
    if (business.ownerId !== authUser._id) { throw new Error("Not authorized..."); }
    
    // TO
    const authUser = await requireAuth(ctx);
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    const isOwner = await isBusinessOwner(ctx, customer.businessId);
    if (!isOwner) throw new Error("Not authorized...");
    ```
  - Pattern for query (list):
    ```typescript
    // FROM
    if (!business || business.ownerId !== authUser._id) { return []; }
    
    // TO  
    const isOwner = await isBusinessOwner(ctx, customer.businessId);
    if (!isOwner) return [];
    ```

  **Must NOT do**:
  - Change error messages beyond what utilities provide
  - Modify business logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None needed - straightforward find/replace

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5)
  - **Blocks**: Task 16 (verification)
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/lib/auth.ts:16-84` - All utility function signatures
  - `packages/backend/convex/customerAddresses.ts` - Target file (231 lines)
  - `packages/backend/convex/conversations.ts:17-26` - Example of correct try-catch pattern

  **Acceptance Criteria**:
  - [ ] Import updated: `import { getAuthUser, requireAuth, isBusinessOwner } from "./lib/auth";`
  - [ ] Zero `throw new Error("Not authenticated")` patterns remain
  - [ ] Zero `business.ownerId !== authUser._id` patterns remain
  - [ ] `bun run check-types` passes for this file
  - [ ] Queries return [] on auth failure (behavior preserved)
  - [ ] Mutations throw on auth failure (behavior preserved)

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in customerAddresses.ts`
  - Files: `packages/backend/convex/customerAddresses.ts`

---

- [ ] 2. Refactor customerNotes.ts (7 patterns)

  **What to do**:
  - Update import: add `requireAuth`, `isBusinessOwner` to existing import
  - Replace 3 inline auth throws (lines 43, 81, 122) with `requireAuth(ctx)`
  - Replace 4 ownership checks (lines 21, 56, 99, 140) appropriately
  - Query (list): use `isBusinessOwner()` → return []
  - Mutations (add, update, deleteNote): use `requireAuth()` + `isBusinessOwner()` → throw

  **Must NOT do**:
  - Change error messages
  - Modify business logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/lib/auth.ts:16-84` - Utility signatures
  - `packages/backend/convex/customerNotes.ts` - Target file (149 lines)

  **Acceptance Criteria**:
  - [ ] Import updated with `requireAuth`, `isBusinessOwner`
  - [ ] Zero inline auth throws remain
  - [ ] Zero manual ownership checks remain
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in customerNotes.ts`
  - Files: `packages/backend/convex/customerNotes.ts`

---

- [ ] 3. Refactor deletionRequests.ts (6 patterns)

  **What to do**:
  - Update import: add `requireAuth`, `isBusinessOwner`
  - Replace 2 inline auth throws (lines 116, 199) with `requireAuth(ctx)`
  - Replace 4 ownership checks (lines 17, 65, 125, 208)
  - Queries (list, getPendingCount): `isBusinessOwner()` → return default
  - Mutations (approve, deny): `requireAuth()` + ownership check → throw

  **Must NOT do**:
  - Touch `create` (it's internalMutation - no auth needed)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/lib/auth.ts:16-84`
  - `packages/backend/convex/deletionRequests.ts` - Target file (228 lines)

  **Acceptance Criteria**:
  - [ ] Import updated
  - [ ] Zero inline auth throws
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes
  - [ ] `create` (internalMutation) unchanged

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in deletionRequests.ts`
  - Files: `packages/backend/convex/deletionRequests.ts`

---

- [ ] 4. Refactor orders.ts (5 patterns)

  **What to do**:
  - File already imports `getAuthUser`, `requireBusinessOwnership`
  - Replace 5 ownership checks (lines 437, 461, 495, 527, 573)
  - These appear to be in queries - use `isBusinessOwner()`
  - Add `isBusinessOwner` to import

  **Must NOT do**:
  - Change mutation patterns that already use requireBusinessOwnership correctly

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/lib/auth.ts:46-58` - isBusinessOwner signature
  - `packages/backend/convex/orders.ts` - Target file (large)

  **Acceptance Criteria**:
  - [ ] Import includes `isBusinessOwner`
  - [ ] Zero manual ownership checks in queries
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in orders.ts`
  - Files: `packages/backend/convex/orders.ts`

---

- [ ] 5. Refactor conversationSummaries.ts (5 patterns)

  **What to do**:
  - Update import: add `requireAuth`, `isBusinessOwner`
  - Replace 1 inline auth throw (line 118) with `requireAuth(ctx)`
  - Replace 4 ownership checks (lines 21, 49, 83, 131)
  - Queries (get, listByCustomer, search): `isBusinessOwner()` → return default
  - Mutation (create): `requireAuth()` + ownership check → throw

  **Must NOT do**:
  - Touch `createInternal` (internalMutation)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/lib/auth.ts:16-84`
  - `packages/backend/convex/conversationSummaries.ts` - Target file (213 lines)

  **Acceptance Criteria**:
  - [ ] Import updated
  - [ ] Zero inline auth throws
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes
  - [ ] `createInternal` unchanged

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in conversationSummaries.ts`
  - Files: `packages/backend/convex/conversationSummaries.ts`

---

### Wave 2: Medium Impact Files

- [ ] 6. Refactor customers.ts (4 patterns)

  **What to do**:
  - File already imports `getAuthUser`, `requireBusinessOwnership`
  - Add `isBusinessOwner` to import
  - Replace 4 ownership checks (lines 21, 41, 79, 209)
  - All appear to be queries - use `isBusinessOwner()`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/customers.ts`

  **Acceptance Criteria**:
  - [ ] Import includes `isBusinessOwner`
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in customers.ts`
  - Files: `packages/backend/convex/customers.ts`

---

- [ ] 7. Refactor dashboard.ts (2 patterns)

  **What to do**:
  - Update import: add `isBusinessOwner`
  - Replace 2 ownership checks (lines 16, 103)
  - Both are queries - use `isBusinessOwner()`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/dashboard.ts` - Target file (193 lines)

  **Acceptance Criteria**:
  - [ ] Import includes `isBusinessOwner`
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in dashboard.ts`
  - Files: `packages/backend/convex/dashboard.ts`

---

- [ ] 8. Refactor ai/settings.ts (2 patterns)

  **What to do**:
  - File already imports `getAuthUser`, `requireBusinessOwnership`
  - Add `isBusinessOwner` to import
  - Replace 2 ownership checks (lines 27, 70)
  - Both are in queries - use `isBusinessOwner()`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/ai/settings.ts` - Target file (104 lines)

  **Acceptance Criteria**:
  - [ ] Import includes `isBusinessOwner`
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in ai/settings.ts`
  - Files: `packages/backend/convex/ai/settings.ts`

---

- [ ] 9. Refactor products.ts (2 patterns)

  **What to do**:
  - File already imports all utilities
  - Replace 2 ownership checks (lines 128, 160)
  - Determine if queries or mutations and use appropriate utility

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/products.ts`

  **Acceptance Criteria**:
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in products.ts`
  - Files: `packages/backend/convex/products.ts`

---

- [ ] 10. Refactor integrations/meta/actions.ts (2 patterns)

  **What to do**:
  - File already imports `getAuthUser`
  - Add `isBusinessOwner` to import
  - Replace 2 ownership checks (lines 99, 151)
  - Note: line 99 is in `verifyBusinessOwnership` internalQuery - this is a helper for actions
  - Line 151 is in `getMessagingWindowStatus` query

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/integrations/meta/actions.ts` - Target file (1330 lines)

  **Acceptance Criteria**:
  - [ ] Import includes `isBusinessOwner`
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in meta/actions.ts`
  - Files: `packages/backend/convex/integrations/meta/actions.ts`

---

- [ ] 11. Refactor integrations/whatsapp/settings.ts (2 patterns)

  **What to do**:
  - File imports `getAuthUser`, `requireAuth`, `requireBusinessOwnership` already
  - Replace direct `authComponent.safeGetAuthUser(ctx)` call (line 148) with `getAuthUser(ctx)`
  - Replace inline auth throw (line 149) with `requireAuth(ctx)`
  - Note: This is in `testConnection` action

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/integrations/whatsapp/settings.ts` - Target file (216 lines)
  - `packages/backend/convex/lib/auth.ts:16-18` - getAuthUser signature

  **Acceptance Criteria**:
  - [ ] Zero direct `authComponent.safeGetAuthUser` calls
  - [ ] Zero inline auth throws
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in whatsapp/settings.ts`
  - Files: `packages/backend/convex/integrations/whatsapp/settings.ts`

---

- [ ] 12. Refactor shopify.ts (2 patterns)

  **What to do**:
  - File already imports `getAuthUser`, `requireAuth`, `requireBusinessOwnership`
  - Replace direct `authComponent.safeGetAuthUser(ctx)` call (line 1337) with `getAuthUser(ctx)`
  - Replace ownership check (line 1207) - determine if query or mutation

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/shopify.ts` - Target file (large, ~1400+ lines)

  **Acceptance Criteria**:
  - [ ] Zero direct `authComponent.safeGetAuthUser` calls
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in shopify.ts`
  - Files: `packages/backend/convex/shopify.ts`

---

### Wave 3: Low Impact + Verification

- [ ] 13. Refactor businesses.ts (1 pattern)

  **What to do**:
  - File already imports all utilities correctly
  - Replace 1 ownership check (line 145)
  - Add `isBusinessOwner` to import if not present

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/businesses.ts`

  **Acceptance Criteria**:
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in businesses.ts`
  - Files: `packages/backend/convex/businesses.ts`

---

- [ ] 14. Refactor categories.ts (1 pattern)

  **What to do**:
  - File already imports `getAuthUser`, `requireBusinessOwnership`
  - Add `isBusinessOwner` to import
  - Replace 1 ownership check (line 84)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/categories.ts`

  **Acceptance Criteria**:
  - [ ] Import includes `isBusinessOwner`
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in categories.ts`
  - Files: `packages/backend/convex/categories.ts`

---

- [ ] 15. Refactor customerMemory.ts (1 pattern)

  **What to do**:
  - File already imports `getAuthUser`, `requireBusinessOwnership`
  - Add `isBusinessOwner` to import
  - Replace 1 ownership check (line 36)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 16
  - **Blocked By**: None

  **References**:
  - `packages/backend/convex/customerMemory.ts`

  **Acceptance Criteria**:
  - [ ] Import includes `isBusinessOwner`
  - [ ] Zero manual ownership checks
  - [ ] `bun run check-types` passes

  **Commit**: YES
  - Message: `refactor(backend): use auth utilities in customerMemory.ts`
  - Files: `packages/backend/convex/customerMemory.ts`

---

- [ ] 16. Final Verification

  **What to do**:
  - Run full type-checking: `bun run check-types`
  - Run linter: `bun run check`
  - Run build: `bun run build`
  - Verify no remaining anti-patterns with grep:
    ```bash
    grep -r "authComponent.safeGetAuthUser" packages/backend/convex --include="*.ts" | grep -v "lib/auth.ts" | grep -v "auth.ts:"
    grep -r 'throw new Error("Not authenticated")' packages/backend/convex --include="*.ts" | grep -v "lib/auth.ts"
    grep -r "ownerId !== authUser._id" packages/backend/convex --include="*.ts" | grep -v "lib/auth.ts"
    ```

  **Must NOT do**:
  - Make any code changes (verification only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: None

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: None (final task)
  - **Blocks**: None
  - **Blocked By**: Tasks 1-15

  **References**:
  - All 15 refactored files

  **Acceptance Criteria**:
  - [ ] `bun run check-types` → 0 errors
  - [ ] `bun run check` → 0 errors
  - [ ] `bun run build` → success
  - [ ] Grep for anti-patterns → 0 results (excluding lib/auth.ts)

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 1 | `refactor(backend): use auth utilities in customerAddresses.ts` | customerAddresses.ts |
| 2 | `refactor(backend): use auth utilities in customerNotes.ts` | customerNotes.ts |
| 3 | `refactor(backend): use auth utilities in deletionRequests.ts` | deletionRequests.ts |
| 4 | `refactor(backend): use auth utilities in orders.ts` | orders.ts |
| 5 | `refactor(backend): use auth utilities in conversationSummaries.ts` | conversationSummaries.ts |
| 6 | `refactor(backend): use auth utilities in customers.ts` | customers.ts |
| 7 | `refactor(backend): use auth utilities in dashboard.ts` | dashboard.ts |
| 8 | `refactor(backend): use auth utilities in ai/settings.ts` | ai/settings.ts |
| 9 | `refactor(backend): use auth utilities in products.ts` | products.ts |
| 10 | `refactor(backend): use auth utilities in meta/actions.ts` | meta/actions.ts |
| 11 | `refactor(backend): use auth utilities in whatsapp/settings.ts` | whatsapp/settings.ts |
| 12 | `refactor(backend): use auth utilities in shopify.ts` | shopify.ts |
| 13 | `refactor(backend): use auth utilities in businesses.ts` | businesses.ts |
| 14 | `refactor(backend): use auth utilities in categories.ts` | categories.ts |
| 15 | `refactor(backend): use auth utilities in customerMemory.ts` | customerMemory.ts |

**Alternative**: Squash all into single commit:
`refactor(backend): replace manual auth patterns with shared utilities (S03)`

---

## Success Criteria

### Verification Commands
```bash
# TypeScript compilation
bun run check-types  # Expected: 0 errors

# Linting
bun run check  # Expected: 0 errors

# Build
bun run build  # Expected: success

# Anti-pattern verification
grep -r "authComponent.safeGetAuthUser" packages/backend/convex --include="*.ts" | grep -v "lib/auth.ts" | grep -v "auth.ts:"
# Expected: 0 results

grep -r 'throw new Error("Not authenticated")' packages/backend/convex --include="*.ts" | grep -v "lib/auth.ts"
# Expected: 0 results

grep -r "ownerId !== authUser._id" packages/backend/convex --include="*.ts" | grep -v "lib/auth.ts"
# Expected: 0 results
```

### Final Checklist
- [ ] All "Must Have" present (51 patterns replaced)
- [ ] All "Must NOT Have" absent (no new helpers, no lib/auth.ts changes)
- [ ] All type checks pass
- [ ] Behavior preserved (queries soft-fail, mutations hard-fail)
