# Draft: S03 - Use Shared Auth Utilities

## Requirements (confirmed)

- Replace manual auth patterns with shared utilities from `packages/backend/convex/lib/auth.ts`
- Available utilities:
  - `getAuthUser(ctx)` - returns user or null (wraps `authComponent.safeGetAuthUser`)
  - `requireAuth(ctx)` - throws if not authenticated
  - `requireBusinessOwnership(ctx, businessId)` - throws if user doesn't own business, returns `{ user, business }`
  - `isBusinessOwner(ctx, businessId)` - boolean check (defined but not used)

## Anti-Patterns Found (38 manual ownership checks + 2 direct authComponent calls + 11 inline throws = 51 total)

### Pattern 1: Manual ownership checks (`business.ownerId !== authUser._id`)
**39 occurrences across 15 files** (1 in lib/auth.ts itself is expected)

| File | Count | Lines |
|------|-------|-------|
| deletionRequests.ts | 4 | 17, 65, 125, 208 |
| customerAddresses.ts | 5 | 21, 61, 121, 176, 211 |
| conversationSummaries.ts | 4 | 21, 49, 83, 131 |
| dashboard.ts | 2 | 16, 103 |
| orders.ts | 5 | 437, 461, 495, 527, 573 |
| categories.ts | 1 | 84 |
| products.ts | 2 | 128, 160 |
| shopify.ts | 1 | 1207 |
| businesses.ts | 1 | 145 |
| customerMemory.ts | 1 | 36 |
| customers.ts | 4 | 21, 41, 79, 209 |
| ai/settings.ts | 2 | 27, 70 |
| customerNotes.ts | 4 | 21, 56, 99, 140 |
| integrations/meta/actions.ts | 2 | 99, 151 |

### Pattern 2: Direct `authComponent.safeGetAuthUser()` usage
**2 occurrences** (should use `getAuthUser()` instead)

| File | Line |
|------|------|
| integrations/whatsapp/settings.ts | 148 |
| shopify.ts | 1337 |

### Pattern 3: Inline `throw new Error("Not authenticated")`
**11 occurrences** (should use `requireAuth()` instead)

| File | Count | Lines |
|------|-------|-------|
| customerAddresses.ts | 4 | 48, 103, 158, 193 |
| customerNotes.ts | 3 | 43, 81, 122 |
| deletionRequests.ts | 2 | 116, 199 |
| conversationSummaries.ts | 1 | 118 |
| integrations/whatsapp/settings.ts | 1 | 149 |

## Files Already Using Shared Utilities (GOOD - no changes needed)

These files already import and use the utilities correctly:
- ai/settings.ts - uses `requireBusinessOwnership` for mutations, BUT still has 2 manual ownership checks in queries
- conversations.ts - already imports all utilities
- messages.ts - already imports `getAuthUser`, `requireAuth`
- orders.ts - already imports `getAuthUser`, `requireBusinessOwnership`
- products.ts - already imports all utilities
- businesses.ts - already imports all utilities

## Files Needing Import Updates

These files need to add imports:
- customerAddresses.ts - needs `requireAuth` added to import
- customerNotes.ts - needs `requireAuth` added to import
- conversationSummaries.ts - needs `requireAuth` added to import
- deletionRequests.ts - needs `requireAuth` added to import
- dashboard.ts - needs `isBusinessOwner` added (for query pattern)
- customerMemory.ts - already has correct imports
- categories.ts - already has correct imports
- shopify.ts - needs to use `getAuthUser` instead of `authComponent.safeGetAuthUser`
- integrations/whatsapp/settings.ts - needs `getAuthUser` imported from `../../lib/auth`
- integrations/meta/actions.ts - already imports `getAuthUser` from `../../lib/auth`

## Refactoring Complexity Analysis

### Simple Replacements (Mutations with throws)
For mutations that throw on auth failure, the pattern is straightforward:
```typescript
// FROM
const authUser = await getAuthUser(ctx);
if (!authUser) {
  throw new Error("Not authenticated");
}
// ... later ...
if (business.ownerId !== authUser._id) {
  throw new Error("Not authorized");
}

// TO
const { user, business } = await requireBusinessOwnership(ctx, args.businessId);
```

### Query Pattern (soft fail - returns null/empty)
For queries that return null/empty instead of throwing:
```typescript
// OPTION A: Keep as-is (manual check)
const authUser = await getAuthUser(ctx);
if (!authUser) return null;
const business = await ctx.db.get(args.businessId);
if (!business || business.ownerId !== authUser._id) return null;

// OPTION B: Use isBusinessOwner (cleaner)
const isOwner = await isBusinessOwner(ctx, args.businessId);
if (!isOwner) return null;

// OPTION C: Use try-catch with requireBusinessOwnership
try {
  await requireBusinessOwnership(ctx, args.businessId);
} catch {
  return null;
}
```

### Special Cases

1. **Indirect business ownership** (customerAddresses.ts, customerNotes.ts, conversationSummaries.ts)
   - These check ownership via customer → business chain
   - Cannot directly use `requireBusinessOwnership` because businessId is derived from customer
   - Need to keep some manual logic

2. **Actions with internal queries** (shopify.ts, integrations/meta/actions.ts)
   - Actions use `ctx.runQuery(internal.*.verifyBusinessOwnership)` pattern
   - This is appropriate for actions that can't directly use query-only functions

## Open Questions

1. **Query soft-fail pattern**: Should we keep the existing try-catch pattern with `requireBusinessOwnership` (seen in whatsapp/settings.ts), or switch to `isBusinessOwner`?

2. **Indirect ownership checks**: For files that check ownership via customer/conversation → business chain, should we:
   - Keep manual checks (since businessId is derived)?
   - Create new helpers like `requireCustomerAccess(ctx, customerId)`?

## Confirmed by Explore Agent Analysis

- **51 anti-patterns** total across 15 files (excluding lib/auth.ts itself)
- **39 manual ownership checks** - can use `requireBusinessOwnership` or `isBusinessOwner`
- **2 direct authComponent calls** - should use `getAuthUser`
- **11 inline auth throws** - should use `requireAuth`

Files already using utilities correctly (partial adoption):
- conversations.ts - uses requireBusinessOwnership with try-catch pattern
- messages.ts - uses requireAuth
- businesses.ts - uses both requireAuth and requireBusinessOwnership

## Scope Boundaries

- INCLUDE: All 51 manual auth patterns identified
- EXCLUDE: 
  - lib/auth.ts (the source of utilities)
  - Files with only `internalMutation`/`internalQuery` (no auth needed)
  - Creating new helper functions (use existing ones)
