# S03 - Use Shared Auth Utilities (Remaining Migration)

## TL;DR

> **Quick Summary**: Complete the remaining auth migration by replacing 41 direct `authComponent.safeGetAuthUser` calls across 13 backend files with the shared auth utilities from `lib/auth.ts`.
> 
> **Deliverables**:
> - 9 root-level files migrated (33 calls)
> - 1 ai/ directory file migrated (3 calls)
> - 3 integrations/ directory files migrated (5 calls)
> - Zero direct `authComponent.safeGetAuthUser` calls remaining (except in lib/auth.ts)
> - Single atomic commit: `feat: S03 - Use shared auth utilities`
> 
> **Estimated Effort**: Short (mechanical replacements)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Wave 1 (root) || Wave 2 (ai) || Wave 3 (integrations) → Verification → Commit

---

## Context

### Original Request
Complete S03 by migrating remaining 41 manual auth checks across 13 files to use shared auth utilities from `packages/backend/convex/lib/auth.ts`.

### Prior Work Completed (9 files already migrated)
- businesses.ts, orders.ts, products.ts, messages.ts, conversations.ts
- customers.ts, integrations/meta/queries.ts

### Interview Summary
**Key Discussions**:
- Batching: Group by directory (root, ai/, integrations/)
- Verification: TypeScript + grep confirmation of zero remaining direct calls
- Commit: Single atomic commit per Ralph pattern

**Research Findings**:
- All 13 files analyzed - patterns are mechanical and consistent
- `notifications.ts` is user-scoped (not business), needs different handling
- 2 files already import helpers, just need direct call replacement (shopify.ts, whatsapp/settings.ts)
- Internal functions (internalQuery/internalMutation) excluded - no user context

### Self-Review Findings
**Potential gaps addressed**:
- Remove `authComponent` import when no longer needed after migration
- Ensure import paths correct for nested directories (`../lib/auth` vs `../../lib/auth`)
- Handle the `notifications.ts` special case (user-scoped, not business-scoped)

---

## Work Objectives

### Core Objective
Replace all remaining direct `authComponent.safeGetAuthUser(ctx)` calls with appropriate shared auth utilities to ensure consistent, DRY authentication patterns across the Convex backend.

### Concrete Deliverables
- 13 files migrated with correct auth utility usage
- All TypeScript compilation passing
- Zero grep matches for direct `authComponent.safeGetAuthUser` in migrated files
- Single atomic commit

### Definition of Done
- [ ] `bun run check-types` passes with exit code 0
- [ ] `grep -r "authComponent.safeGetAuthUser" packages/backend/convex/` returns only `auth.ts` and `lib/auth.ts`
- [ ] Single commit created with message `feat: S03 - Use shared auth utilities`

### Must Have
- All 41 auth checks migrated to shared utilities
- Correct import paths for each directory level
- Proper auth utility selection based on pattern:
  - Queries returning null/empty → `getAuthUser`
  - Mutations throwing → `requireAuth` or `requireBusinessOwnership`
  - Business ownership checks → `requireBusinessOwnership`

### Must NOT Have (Guardrails)
- DO NOT modify internal functions (internalQuery, internalMutation) - they have no user context
- DO NOT change auth logic or behavior - only the implementation pattern
- DO NOT modify `lib/auth.ts` or `auth.ts` files
- DO NOT add unnecessary imports (remove `authComponent` import if no longer used)
- DO NOT change function signatures or return types
- DO NOT modify any business logic beyond auth check replacement

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (no test framework configured)
- **User wants tests**: Manual verification only
- **Framework**: None

### Automated Verification (Agent-Executable)

**TypeScript Compilation Check:**
```bash
# Agent runs:
bun run check-types
# Assert: Exit code 0
# Assert: No type errors in output
```

**Grep Verification:**
```bash
# Agent runs:
grep -r "authComponent.safeGetAuthUser" packages/backend/convex/ --include="*.ts" | grep -v "auth.ts"
# Assert: Empty output (no matches)
# This confirms zero direct calls remain (excluding auth.ts and lib/auth.ts)
```

**Evidence to Capture:**
- [ ] TypeScript check output showing success
- [ ] Grep output showing no remaining direct calls

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Root-level files (9 files, 33 calls)

Wave 2 (Parallel with Wave 1):
├── Task 2: ai/ directory (1 file, 3 calls)

Wave 3 (Parallel with Waves 1 & 2):
├── Task 3: integrations/ directory (3 files, 5 calls)

Wave 4 (After Waves 1-3):
└── Task 4: Final verification & commit

Critical Path: Any wave → Task 4 (verification)
Parallel Speedup: All 3 migration waves run simultaneously
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4 | 2, 3 |
| 2 | None | 4 | 1, 3 |
| 3 | None | 4 | 1, 2 |
| 4 | 1, 2, 3 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1-3 | 1, 2, 3 | `category="quick"` - mechanical replacements |
| 4 | 4 | `category="quick"` - verification only |

---

## TODOs

- [ ] 1. Migrate root-level files (9 files, 33 auth calls)

  **What to do**:
  
  For each file, perform these steps:
  1. Add import: `import { getAuthUser, requireAuth, requireBusinessOwnership } from "./lib/auth";`
  2. Replace auth patterns:
     - **Queries** returning null/[]/0: Replace with `const authUser = await getAuthUser(ctx);` + keep null check
     - **Mutations** throwing: Replace with `const authUser = await requireAuth(ctx);` or `const { user, business } = await requireBusinessOwnership(ctx, businessId);`
  3. Remove `authComponent` import if no longer used in file
  4. For business ownership patterns, use destructured `{ user, business }` and reference `user._id` and `business` directly
  
  **Files to migrate**:
  
  | File | Calls | Patterns |
  |------|-------|----------|
  | `privateData.ts` | 1 | 1 query (return null → `getAuthUser`) |
  | `categories.ts` | 5 | 4 mutations (`requireBusinessOwnership`), 1 query (`getAuthUser` + business check) |
  | `customerMemory.ts` | 4 | 3 mutations (`requireBusinessOwnership`), 1 query (`getAuthUser`) |
  | `dashboard.ts` | 2 | 2 queries (`getAuthUser` + business check) |
  | `conversationSummaries.ts` | 4 | 3 queries (`getAuthUser`), 1 mutation (`requireBusinessOwnership`) |
  | `deletionRequests.ts` | 4 | 2 queries (`getAuthUser`), 2 mutations (`requireBusinessOwnership`) |
  | `notifications.ts` | 4 | 2 queries (`getAuthUser`), 2 mutations (`requireAuth`) - **USER-SCOPED, NOT BUSINESS** |
  | `customerNotes.ts` | 4 | 1 query (`getAuthUser`), 3 mutations (`requireBusinessOwnership`) |
  | `customerAddresses.ts` | 5 | 1 query (`getAuthUser`), 4 mutations (`requireBusinessOwnership`) |

  **Must NOT do**:
  - DO NOT modify internal functions (internalQuery, internalMutation, internalAction)
  - DO NOT change the auth behavior or error messages
  - DO NOT modify function return types
  - DO NOT touch `customerMemory.ts:listByCustomerInternal`, `customerMemory.ts:addInternal`
  - DO NOT touch `conversationSummaries.ts:createInternal`
  - DO NOT touch `deletionRequests.ts:create` (internal mutation)
  - DO NOT touch `notifications.ts:create` (internal mutation)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical search-and-replace refactoring with clear patterns
  - **Skills**: `[]`
    - Standard TypeScript editing, no specialized tooling needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4 (verification)
  - **Blocked By**: None (can start immediately)

  **References**:
  
  **Pattern References** (existing code to follow):
  - `packages/backend/convex/businesses.ts:1-66` - Shows correct migration pattern with `requireAuth` and `requireBusinessOwnership`
  - `packages/backend/convex/lib/auth.ts:1-85` - The shared utilities being used
  
  **Type References**:
  - `packages/backend/convex/lib/auth.ts:68` - `requireBusinessOwnership` returns `{ user, business }`
  
  **Files to modify**:
  - `packages/backend/convex/privateData.ts`
  - `packages/backend/convex/categories.ts`
  - `packages/backend/convex/customerMemory.ts`
  - `packages/backend/convex/dashboard.ts`
  - `packages/backend/convex/conversationSummaries.ts`
  - `packages/backend/convex/deletionRequests.ts`
  - `packages/backend/convex/notifications.ts`
  - `packages/backend/convex/customerNotes.ts`
  - `packages/backend/convex/customerAddresses.ts`

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # After completing all 9 files, run:
  bun run check-types
  # Assert: Exit code 0
  
  # Verify no direct calls remain in these files:
  grep -l "authComponent.safeGetAuthUser" packages/backend/convex/{privateData,categories,customerMemory,dashboard,conversationSummaries,deletionRequests,notifications,customerNotes,customerAddresses}.ts
  # Assert: Empty output (no files match)
  ```

  **Evidence to Capture:**
  - [ ] TypeScript compilation success for each modified file
  - [ ] No grep matches for direct authComponent calls in migrated files

  **Commit**: NO (groups with Task 4)

---

- [ ] 2. Migrate ai/ directory files (1 file, 3 auth calls)

  **What to do**:
  
  Migrate `ai/settings.ts`:
  1. Add import: `import { getAuthUser, requireBusinessOwnership } from "../lib/auth";` (note: `../lib/auth` path for nested directory)
  2. Replace patterns:
     - `getSettings` (query): Use `getAuthUser` + business ownership check returning null
     - `updateSettings` (mutation): Use `requireBusinessOwnership`
     - `getUsageStats` (query): Use `getAuthUser` + business ownership check returning null
  3. Remove `authComponent` import if no longer used

  **Must NOT do**:
  - DO NOT change auth behavior or error messages
  - DO NOT modify return types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, mechanical replacement
  - **Skills**: `[]`
    - Standard TypeScript editing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 1, 3)
  - **Blocks**: Task 4 (verification)
  - **Blocked By**: None (can start immediately)

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/businesses.ts:1-66` - Migration pattern reference
  - `packages/backend/convex/lib/auth.ts:1-85` - Shared utilities
  
  **Files to modify**:
  - `packages/backend/convex/ai/settings.ts`

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  bun run check-types
  # Assert: Exit code 0
  
  grep "authComponent.safeGetAuthUser" packages/backend/convex/ai/settings.ts
  # Assert: Empty output (no matches)
  ```

  **Evidence to Capture:**
  - [ ] TypeScript compilation success
  - [ ] No grep match in ai/settings.ts

  **Commit**: NO (groups with Task 4)

---

- [ ] 3. Migrate integrations/ directory files (3 files, 5 auth calls)

  **What to do**:
  
  **3a. `integrations/meta/actions.ts` (2 calls at lines 89, 140)**:
  1. Add import: `import { getAuthUser } from "../../lib/auth";` (note: `../../lib/auth` path)
  2. Replace patterns in:
     - `verifyBusinessOwnership` (internalQuery at line 89): Use `getAuthUser` + business check returning `{authorized: false}`
     - `getMessagingWindowStatus` (query at line 140): Use `getAuthUser` + business check returning null
  3. Remove `authComponent` import if no longer used
  
  **3b. `shopify.ts` (2 calls at lines 1197, 1337)**:
  - Already imports helpers at line ~15
  - Replace direct `authComponent.safeGetAuthUser` calls:
    - `verifyBusinessOwnership` internalQuery (line 1197): Use `getAuthUser`
    - `createOrder` action (line 1337): Use existing auth pattern via internal query
  
  **3c. `integrations/whatsapp/settings.ts` (1 call at line 148)**:
  - Already imports helpers at line 5
  - Replace direct call in `testConnection` action (line 148): Use existing auth check

  **Must NOT do**:
  - DO NOT modify internal functions that don't have auth calls
  - DO NOT change the OAuth flow logic
  - DO NOT modify webhook handling
  - For actions: Note that actions can't use ctx directly for auth, they need to call internal queries

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical replacement, 3 small files
  - **Skills**: `[]`
    - Standard TypeScript editing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 1, 2)
  - **Blocks**: Task 4 (verification)
  - **Blocked By**: None (can start immediately)

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/businesses.ts:1-66` - Migration pattern reference
  - `packages/backend/convex/integrations/whatsapp/settings.ts:1-20` - Shows partial migration (already has imports)
  
  **Files to modify**:
  - `packages/backend/convex/integrations/meta/actions.ts`
  - `packages/backend/convex/shopify.ts`
  - `packages/backend/convex/integrations/whatsapp/settings.ts`

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  bun run check-types
  # Assert: Exit code 0
  
  grep "authComponent.safeGetAuthUser" packages/backend/convex/integrations/meta/actions.ts packages/backend/convex/shopify.ts packages/backend/convex/integrations/whatsapp/settings.ts
  # Assert: Empty output (no matches)
  ```

  **Evidence to Capture:**
  - [ ] TypeScript compilation success
  - [ ] No grep matches in any integrations files

  **Commit**: NO (groups with Task 4)

---

- [ ] 4. Final verification and commit

  **What to do**:
  
  1. Run full TypeScript check across the backend
  2. Run comprehensive grep to verify zero remaining direct calls
  3. Create single atomic commit with message `feat: S03 - Use shared auth utilities`

  **Must NOT do**:
  - DO NOT skip any verification step
  - DO NOT modify any files in this task (verification only, then commit)
  - DO NOT create multiple commits

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and git commit only
  - **Skills**: `['git-master']`
    - `git-master`: Needed for proper atomic commit creation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 4)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  
  **Pattern References**:
  - `packages/backend/convex/auth.ts` - Should be the ONLY file with direct authComponent usage (besides lib/auth.ts)
  - `packages/backend/convex/lib/auth.ts` - Should contain authComponent calls (this is the wrapper)

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Full TypeScript check
  bun run check-types
  # Assert: Exit code 0
  
  # Comprehensive grep - should return ONLY auth.ts and lib/auth.ts
  grep -r "authComponent.safeGetAuthUser" packages/backend/convex/ --include="*.ts"
  # Assert: Only matches in auth.ts and lib/auth.ts
  
  # Verify git status shows expected changes
  git status --porcelain packages/backend/convex/
  # Assert: 13 modified files (M status)
  
  # Create commit
  git add packages/backend/convex/
  git commit -m "feat: S03 - Use shared auth utilities"
  # Assert: Commit succeeds
  ```

  **Evidence to Capture:**
  - [ ] Full TypeScript check passes
  - [ ] Grep shows only auth.ts and lib/auth.ts with direct calls
  - [ ] Git commit created successfully

  **Commit**: YES
  - Message: `feat: S03 - Use shared auth utilities`
  - Files: All 13 migrated files in `packages/backend/convex/`
  - Pre-commit: `bun run check-types`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 4 | `feat: S03 - Use shared auth utilities` | All 13 migrated files | `bun run check-types` + grep |

---

## Success Criteria

### Verification Commands
```bash
# TypeScript compilation
bun run check-types
# Expected: Exit code 0, no errors

# Grep for remaining direct calls
grep -r "authComponent.safeGetAuthUser" packages/backend/convex/ --include="*.ts" | grep -v -E "(auth\.ts|lib/auth\.ts)"
# Expected: Empty output (no matches)

# Count of remaining direct calls (should be exactly 2 - in auth.ts and lib/auth.ts)
grep -r "authComponent.safeGetAuthUser" packages/backend/convex/ --include="*.ts" -c
# Expected: auth.ts:0, lib/auth.ts:1 (the wrapper function)
```

### Final Checklist
- [ ] All 41 auth checks replaced with shared utilities
- [ ] All 13 files migrated
- [ ] TypeScript compilation passes
- [ ] No direct `authComponent.safeGetAuthUser` calls remain (except in auth wrapper files)
- [ ] Single atomic commit created
- [ ] No behavior changes introduced
