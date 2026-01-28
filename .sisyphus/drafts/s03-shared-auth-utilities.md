# Draft: S03 - Use Shared Auth Utilities

## Requirements (confirmed)
- Migrate 13 files from direct `authComponent.safeGetAuthUser(ctx)` to shared auth utilities
- 41 total manual auth checks need replacement
- Shared utilities are in `packages/backend/convex/lib/auth.ts`
- Four helper functions available:
  - `getAuthUser(ctx)` - Returns user or null (safe, for queries)
  - `requireAuth(ctx)` - Returns user or throws error (for mutations)
  - `isBusinessOwner(ctx, businessId)` - Returns boolean
  - `requireBusinessOwnership(ctx, businessId)` - Returns {user, business} or throws

## Files Analyzed

### Group 1: Simple replacements (root level files)
| File | Calls | Pattern | Import Path |
|------|-------|---------|-------------|
| privateData.ts | 1 | Query with null return | `./lib/auth` |
| categories.ts | 5 | 4 mutations (throw), 1 query (return []) | `./lib/auth` |
| customerMemory.ts | 4 | 3 mutations (throw), 1 query (return []) | `./lib/auth` |
| dashboard.ts | 2 | 2 queries (return null/[]) | `./lib/auth` |
| conversationSummaries.ts | 4 | 3 queries (return null/[]), 1 mutation (throw) | `./lib/auth` |
| deletionRequests.ts | 4 | 2 queries (return 0/[]), 2 mutations (throw) | `./lib/auth` |
| notifications.ts | 4 | 2 queries (return 0/[]), 2 mutations (throw) | `./lib/auth` |
| customerNotes.ts | 4 | 1 query (return []), 3 mutations (throw) | `./lib/auth` |
| customerAddresses.ts | 5 | 1 query (return []), 4 mutations (throw) | `./lib/auth` |

### Group 2: Nested files (different import paths)
| File | Calls | Pattern | Import Path |
|------|-------|---------|-------------|
| ai/settings.ts | 3 | 2 queries (return null), 1 mutation (throw) | `../lib/auth` |
| integrations/meta/actions.ts | 2 | 2 internalQueries (return {authorized:false}) | `../../lib/auth` |

### Group 3: Already partially migrated (need completion)
| File | Remaining Calls | Notes |
|------|-----------------|-------|
| shopify.ts | 2 (lines 1197, 1337) | Already imports helpers, just replace direct calls |
| integrations/whatsapp/settings.ts | 1 (line 148) | Already imports helpers, just replace direct call |

## Technical Decisions

### Pattern Mapping
1. **Queries returning null/empty on auth failure** -> Use `getAuthUser(ctx)` + manual null check
2. **Mutations throwing on auth failure** -> Use `requireAuth(ctx)` or `requireBusinessOwnership(ctx, businessId)`
3. **Business ownership checks** -> Use `requireBusinessOwnership(ctx, businessId)` which returns `{user, business}`

### Special Cases Identified

1. **notifications.ts**: User-based auth (not business-based). Uses `authUser._id` directly without business ownership.
   - Keep using `getAuthUser` for queries, `requireAuth` for mutations
   
2. **integrations/meta/actions.ts**: Internal queries that return `{authorized: boolean, error?: string}`
   - These are called by actions for pre-flight auth checks
   - Can use `getAuthUser` + business lookup pattern

3. **internalQuery/internalMutation functions**: These DON'T need auth migration (no user context)
   - customerMemory.ts: `listByCustomerInternal`, `addInternal`
   - conversationSummaries.ts: `createInternal`
   - deletionRequests.ts: `create` (internal mutation)
   - notifications.ts: `create` (internal mutation)

## Complexity Assessment

All files have **SIMPLE, MECHANICAL** replacements:
- No complex auth flows
- No conditional auth patterns
- Standard if-check-then-return-or-throw patterns
- All match existing migrated patterns (see businesses.ts)

## Open Questions
- None - patterns are clear from existing migrations

## Scope Boundaries
- INCLUDE: All 13 files with direct authComponent calls
- INCLUDE: Proper import path adjustments for nested files
- EXCLUDE: Internal functions (internalQuery, internalMutation) - they have no user context
- EXCLUDE: Action functions that call internal queries for auth (pattern stays same)
