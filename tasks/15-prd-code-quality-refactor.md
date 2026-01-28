# Code Quality & Architecture Refactor - Product Requirements Document

## Overview

Comprehensive refactoring initiative to establish professional-grade code quality standards across the Echo monorepo (web app + Convex backend). This project eliminates technical debt through automated linting, consistent naming conventions, DRY principles, and improved file organization.

## Problem Statement

The Echo codebase currently suffers from:
- **No linting infrastructure** - Zero automated code quality checks (no Biome/ESLint/Prettier)
- **File naming chaos** - Mixed PascalCase, kebab-case, camelCase across 118 web files
- **Massive code duplication** - `formatCurrency()` duplicated 8+ times, `requireAuth()` duplicated 50+ times
- **Unmaintainable file sizes** - customers/$customerId.tsx (1,451 lines), shopify.ts (56KB)
- **Inconsistent export patterns** - Mix of default/named exports causing confusion
- **No pre-commit validation** - Bad code reaches main branch

This creates friction for developers, slows feature velocity, and increases bug surface area.

## Goals

- Establish Biome linting with pre-commit hooks (Lefthook)
- Standardize all file naming to kebab-case (TanStack convention)
- Extract shared utilities to eliminate 60+ code duplications
- Split large files into maintainable <500 line modules
- Enforce consistent export patterns (named for components, default for routes)
- Improve developer experience and code maintainability

## Non-Goals (Out of Scope)

- Changing business logic or feature behavior
- Adding new features or capabilities
- Migrating frameworks or libraries
- Performance optimization (unless related to file size)
- Database schema changes
- UI/UX redesigns

## User Stories

### Story 1: Developer - Set Up Automated Code Quality Checks

**As a** developer working on Echo
**I want** automated linting and formatting on every commit
**So that** code quality issues are caught before they reach the codebase

**Acceptance Criteria:**
- [ ] Biome installed and configured based on better-t-stack template
- [ ] VS Code auto-formats on save
- [ ] Pre-commit hooks run Biome checks on staged files
- [ ] Pre-commit hooks run TypeScript type checking
- [ ] Pre-push hooks run full build validation
- [ ] `bun run check` passes with 0 errors across entire codebase
- [ ] Team documentation updated with linting workflows

### Story 2: Developer - Use Shared Formatting Utilities

**As a** developer displaying prices/dates in the UI
**I want** a single source of truth for formatting logic
**So that** I don't duplicate code and formatting stays consistent

**Acceptance Criteria:**
- [ ] `apps/web/src/lib/formatting.ts` created with:
  - `CURRENCY_LOCALES` constant (COP, BRL, MXN, USD)
  - `CURRENCY_SYMBOLS` constant
  - `formatCurrency(amountInCents, currency)` function
  - `formatDate(date, locale, options)` function
  - `formatDateTime(date, locale)` function
  - `formatRelativeTime(date)` function
- [ ] 8+ files updated to import from shared module:
  - `routes/dashboard/index.tsx`
  - `routes/orders/index.tsx`
  - `routes/customers/$customerId.tsx`
  - `routes/products/index.tsx`
  - `components/ProductCard.tsx`
  - `components/PriceInput.tsx`
  - And 2+ more files
- [ ] All duplicate formatting implementations removed
- [ ] All imports resolve correctly
- [ ] No runtime errors in dev environment

### Story 3: Backend Developer - Use Shared Auth Utilities

**As a** backend developer writing mutations
**I want** reusable auth helper functions
**So that** I don't copy-paste auth checks 50+ times

**Acceptance Criteria:**
- [ ] `packages/backend/convex/lib/auth.ts` created with:
  - `requireAuth(ctx)` - throws if not authenticated
  - `requireBusinessOwnership(ctx, businessId)` - throws if user doesn't own business
  - `getAuthUser(ctx)` - returns user or null (no throw)
  - `isBusinessOwner(ctx, businessId)` - boolean check
- [ ] 50+ manual auth checks replaced across all backend files:
  - `businesses.ts` (12 checks)
  - `products.ts` (15 checks)
  - `orders.ts` (18 checks)
  - `customers.ts` (8 checks)
  - `conversations.ts` (10 checks)
  - `messages.ts` (6 checks)
  - `whatsapp.ts` (5 checks)
  - `shopify.ts` (8 checks)
- [ ] All mutations using new helpers
- [ ] All tests pass
- [ ] TypeScript compilation succeeds

### Story 4: Developer - Navigate Consistently Named Files

**As a** developer navigating the codebase
**I want** all component files to use kebab-case naming
**So that** file organization follows TanStack conventions and is predictable

**Acceptance Criteria:**
- [ ] All 14+ PascalCase component files renamed to kebab-case:
  - `ImageUpload.tsx` → `image-upload.tsx`
  - `PriceInput.tsx` → `price-input.tsx`
  - `ProductCard.tsx` → `product-card.tsx`
  - `ProductForm.tsx` → `product-form.tsx`
  - `AppHeader.tsx` → `app-header.tsx`
  - `MessageBubble.tsx` → `message-bubble.tsx`
  - `StatusBadge.tsx` → `status-badge.tsx`
  - `MetricCard.tsx` → `metric-card.tsx`
  - `CustomerCard.tsx` → `customer-card.tsx`
  - `OrderCard.tsx` → `order-card.tsx`
  - `ConversationList.tsx` → `conversation-list.tsx`
  - `BusinessSelector.tsx` → `business-selector.tsx`
  - `LanguageSelector.tsx` → `language-selector.tsx`
  - `CurrencySelector.tsx` → `currency-selector.tsx`
- [ ] All imports updated automatically using ast-grep
- [ ] Git history preserved using `git mv`
- [ ] `bun run check-types` passes with 0 errors
- [ ] `bun run dev` starts without errors
- [ ] Manual smoke test confirms all routes load

### Story 5: Developer - Work with Consistent Export Patterns

**As a** developer importing components
**I want** predictable export patterns
**So that** I know whether to use default or named imports

**Acceptance Criteria:**
- [ ] All UI components use named exports (e.g., `export function Button()`)
- [ ] All route components use default exports (TanStack Router requirement)
- [ ] All utility modules use named exports
- [ ] Documentation updated with export conventions in AGENTS.md
- [ ] No import errors after standardization

### Story 6: Developer - Work with Smaller, Focused Files

**As a** developer reviewing or editing code
**I want** files to be under 500 lines
**So that** code is easier to understand, review, and maintain

**Acceptance Criteria:**

**Frontend:**
- [ ] `customers/$customerId.tsx` (1,451 lines) split into:
  - `$customerId.tsx` (100 lines) - Route + layout
  - `$customerId/components/customer-header.tsx` (150 lines)
  - `$customerId/components/orders-tab.tsx` (400 lines)
  - `$customerId/components/conversations-tab.tsx` (350 lines)
  - `$customerId/components/profile-tab.tsx` (300 lines)
  - `$customerId/components/activity-tab.tsx` (200 lines)
- [ ] `settings.tsx` (723 lines) split into:
  - `settings/index.tsx` (80 lines)
  - `settings/components/general-settings.tsx` (200 lines)
  - `settings/components/whatsapp-settings.tsx` (180 lines)
  - `settings/components/ai-settings.tsx` (150 lines)
  - `settings/components/billing-settings.tsx` (120 lines)
- [ ] `conversations.$conversationId.tsx` (607 lines) split into:
  - `$conversationId.tsx` (80 lines)
  - `$conversationId/components/conversation-header.tsx` (100 lines)
  - `$conversationId/components/message-list.tsx` (250 lines)
  - `$conversationId/components/message-input.tsx` (150 lines)

**Backend:**
- [ ] `shopify.ts` (56KB, ~1,800 lines) split into:
  - `shopify/oauth.ts` (200 lines)
  - `shopify/webhooks.ts` (400 lines)
  - `shopify/sync-products.ts` (600 lines)
  - `shopify/sync-orders.ts` (300 lines)
  - `shopify/sync-customers.ts` (200 lines)
  - `shopify/lib.ts` (100 lines)
- [ ] `http.ts` (24KB, ~800 lines) split into:
  - `http/auth.ts` (200 lines)
  - `http/webhooks.ts` (300 lines)
  - `http/shopify.ts` (200 lines)
  - `http/index.ts` (100 lines)
- [ ] `orders.ts` (21KB, ~700 lines) split into:
  - `orders/queries.ts` (200 lines)
  - `orders/mutations.ts` (300 lines)
  - `orders/lib.ts` (200 lines)
  - `orders/index.ts` (50 lines)

**Validation:**
- [ ] All files <500 lines
- [ ] Each module has single responsibility
- [ ] All imports resolve correctly
- [ ] All tests pass
- [ ] No runtime errors

### Story 7: Developer - Use Reusable Custom Hooks

**As a** React developer
**I want** custom hooks for common patterns
**So that** I don't duplicate state management logic across components

**Acceptance Criteria:**
- [ ] `use-business-context.tsx` - Context provider for business ID, currency, timezone
- [ ] `use-convex-mutation.ts` - Wraps mutations with automatic toast error handling
- [ ] `use-debounce.ts` - Debounces values (e.g., search inputs)
- [ ] `use-pagination.ts` - Pagination state management
- [ ] All hooks have JSDoc comments
- [ ] Usage examples in comments
- [ ] Duplicate logic replaced with hooks in 10+ components

## Technical Requirements

### Stack
- **Linter:** Biome (based on better-t-stack configuration)
- **Pre-commit:** Lefthook (Rust-based, faster than Husky)
- **File Naming:** kebab-case (TanStack Router convention)
- **Formatter:** Tabs, 100 char line width, double quotes
- **Runtime:** Bun 1.3.6
- **Frontend:** React 19, TanStack Start
- **Backend:** Convex

### Biome Configuration

**File:** `biome.json` (root)

```json
{
	"$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
	"vcs": {
		"enabled": true,
		"clientKind": "git",
		"useIgnoreFile": true,
		"defaultBranch": "main"
	},
	"files": {
		"ignore": [
			"node_modules",
			"dist",
			".turbo",
			".convex",
			"apps/web/.vinxi",
			"apps/web/.output",
			"packages/backend/.convex"
		]
	},
	"formatter": {
		"enabled": true,
		"indentStyle": "tab",
		"lineWidth": 100
	},
	"organizeImports": {
		"enabled": true
	},
	"linter": {
		"enabled": true,
		"rules": {
			"recommended": true,
			"correctness": {
				"useExhaustiveDependencies": "info",
				"noUnusedVariables": "error",
				"noUnusedImports": "error"
			},
			"nursery": {
				"useSortedClasses": {
					"level": "warn",
					"fix": "safe",
					"options": {
						"functions": ["clsx", "cva", "cn"]
					}
				}
			},
			"style": {
				"noParameterAssign": "error",
				"useAsConstAssertion": "error",
				"useImportType": "error"
			},
			"suspicious": {
				"noExplicitAny": "warn",
				"noConsoleLog": "warn"
			}
		}
	}
}
```

### Lefthook Configuration

**File:** `lefthook.yml` (root)

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx,js,jsx,json}"
      run: bunx biome check --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
    
    typecheck:
      glob: "*.{ts,tsx}"
      run: bun run check-types

pre-push:
  parallel: true
  commands:
    lint:
      run: bun run check
    
    typecheck:
      run: bun run check-types
    
    build:
      run: bun run build
```

### Package Scripts

**Root `package.json`:**
```json
{
	"scripts": {
		"lint": "biome lint .",
		"lint:fix": "biome lint --write .",
		"check": "biome check .",
		"check:fix": "biome check --write .",
		"prepare": "lefthook install"
	}
}
```

## Data Model

No database schema changes required. This refactor focuses on code organization and quality.

## UI/UX

No UI changes. All visual behavior remains identical. Users will not notice any difference.

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| **Linting Coverage** | 0% | 100% | All files pass Biome |
| **Pre-commit Validation** | No | Yes | 100% of commits |
| **Currency Formatting Duplications** | 8+ | 1 | Single utility |
| **Auth Logic Duplications** | 50+ | 0 | Centralized helpers |
| **Files >500 Lines** | 6 files | 0 files | All under limit |
| **PascalCase Component Files** | 20+ | 0 | 100% kebab-case |
| **Export Pattern Consistency** | ~60% | 100% | Documented standard |
| **Code Duplication** | ~15% | <5% | DRY principles |
| **Average File Length** | ~350 lines | <200 lines | Smaller modules |

## Implementation Phases

### Phase 1: Linting Infrastructure (P0) - 4 hours
- Install Biome
- Create biome.json configuration
- Add package.json scripts
- Configure VS Code integration
- Run initial lint and fix auto-fixable issues

### Phase 2: Pre-commit Hooks (P0) - 2 hours
- Install Lefthook
- Create lefthook.yml configuration
- Install git hooks
- Update .gitignore
- Test hooks on sample commits

### Phase 3: Shared Utilities (P0) - 8 hours
- Create `apps/web/src/lib/formatting.ts`
- Replace 8+ frontend formatting duplications
- Create `packages/backend/convex/lib/auth.ts`
- Replace 50+ backend auth duplications
- Remove duplicate StatusBadge component
- Verify all imports and tests

### Phase 4: File Naming (P1) - 6 hours
- Rename 14+ PascalCase components to kebab-case
- Update imports with ast-grep automation
- Run type checking and build validation
- Manual smoke test all routes

### Phase 5: Export Patterns (P1) - 4 hours
- Standardize UI components to named exports
- Ensure route components use default exports
- Update documentation with conventions

### Phase 6: Component Cleanup (P1) - 3 hours
- Remove duplicate components
- Find and remove unused components
- Update all imports

### Phase 7: Split Large Files (P2) - 16 hours
- Split customers/$customerId.tsx into tabs
- Split settings.tsx into sections
- Split conversations.$conversationId.tsx into components
- Split shopify.ts into modules
- Split http.ts into route files
- Split orders.ts into queries/mutations/lib

### Phase 8: Custom Hooks (P2) - 6 hours
- Create useBusinessContext hook
- Create useConvexMutation hook
- Create useDebounce hook
- Create usePagination hook
- Replace duplicate patterns with hooks

**Total Estimated Effort:** 49 hours (~1.5 sprints)

## Timeline

**Week 1: Foundation**
- Days 1-2: Phases 1-2 (linting + hooks)
- Days 3-5: Phase 3 (shared utilities)

**Week 2: Consistency**
- Days 1-2: Phase 4 (file naming)
- Day 3: Phase 5 (export patterns)
- Day 4: Phase 6 (cleanup)
- Day 5: Buffer/testing

**Week 3: Architecture**
- Days 1-3: Phase 7 (split large files - frontend)
- Days 4-5: Phase 7 (split large files - backend)

**Week 4: Polish**
- Days 1-2: Phase 8 (custom hooks)
- Day 3: Full QA and bug fixes
- Day 4: Documentation updates
- Day 5: Deployment and monitoring

## Testing Strategy

### Automated
- **Type Checking:** `bun run check-types` - 0 errors
- **Linting:** `bun run check` - 0 Biome violations
- **Build:** `bun run build` - clean build

### Manual Smoke Test
- [ ] `bun run dev` starts without errors
- [ ] Dashboard loads and displays metrics
- [ ] Products CRUD operations work
- [ ] Orders CRUD operations work
- [ ] Customers CRUD operations work
- [ ] Conversations load and display
- [ ] Settings pages work (all tabs)
- [ ] WhatsApp webhook receives messages
- [ ] Shopify sync imports products

### Critical User Flows
1. **Onboarding:** Sign up → Create business → Connect WhatsApp → Add product
2. **Order Flow:** Customer message → AI response → Order created → Order fulfilled
3. **Shopify Flow:** Connect Shopify → Import products → Sync updates

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking imports during rename | High | Use `git mv` + ast-grep automation |
| Merge conflicts | Medium | Feature freeze, clear communication |
| Lost git history | High | Use `git mv` for all renames |
| Performance regression | Medium | Monitor bundle size, benchmarks |
| Production downtime | Critical | Deploy in low-traffic window, rollback plan ready |

## Rollout Strategy

**Approach:** Incremental (Phase-by-Phase PRs)
- Phase 1-2 (P0) → Merge immediately
- Phase 3-4 (P0-P1) → Merge within 2 days
- Phase 5-6 (P1) → Merge within 1 week
- Phase 7-8 (P2) → Merge within 2 weeks

**Benefits:**
- Reduces merge conflict risk
- Allows testing between phases
- Team can adapt to changes gradually

## Documentation Updates

- [ ] Update AGENTS.md with:
  - Linting workflow (Biome commands)
  - File naming conventions (kebab-case)
  - Export patterns (named vs default)
  - Shared utility locations
- [ ] Create CONTRIBUTING.md with:
  - Code style guide
  - Pre-commit hook behavior
  - How to bypass hooks (--no-verify)
- [ ] Update README.md with:
  - Code quality section
  - Lint commands
  - Development workflow
