# Draft: S06 - Work with Smaller, Focused Files

## Requirements (confirmed)

- **Objective**: Split 6 large files (3 frontend + 3 backend) into smaller, focused modules (<500 lines each)
- **Files to Refactor**:
  - Frontend:
    1. `customers/$customerId.tsx` — 1,674 lines
    2. `settings.tsx` — 736 lines  
    3. `conversations.$conversationId.tsx` — 613 lines
  - Backend:
    4. `shopify.ts` — 1,989 lines
    5. `http.ts` — 754 lines
    6. `orders.ts` — 838 lines
- **Quality Bar**: All files <500 lines, single responsibility, type checks pass

## Technical Decisions

### Frontend Component Organization

**Decision**: Follow established Echo pattern — centralized `@/components/{feature}/` directories

**Evidence from codebase**:
- `@/components/conversation/` contains 5 extracted components (message-bubble.tsx, message-input.tsx, etc.)
- `@/components/products/` contains 4 extracted components (product-form.tsx, product-table.tsx, etc.)
- `@/components/integrations/` contains 3 extracted components (meta-connect-button.tsx, etc.)
- NO route-specific `$param/components/` subdirectories exist (confirmed)

**Extraction Structure**:
```
apps/web/src/components/customers/
├── tabs/
│   ├── overview-tab.tsx
│   ├── orders-tab.tsx
│   ├── conversations-tab.tsx
│   ├── preferences-tab.tsx
│   └── notes-tab.tsx
├── dialogs/
│   ├── edit-customer-dialog.tsx
│   └── delete-customer-dialog.tsx
└── sections/
    └── addresses-section.tsx

apps/web/src/components/settings/
├── general-settings.tsx
├── ai-settings.tsx
├── chats-integrations-settings.tsx
├── shops-integrations-settings.tsx
├── sticky-save-button.tsx
└── integration-cards/
    ├── shopify-integration-card.tsx
    └── meta-integration-card.tsx

apps/web/src/components/conversation/
└── customer-context-panel.tsx (NEW - add to existing directory)
```

### Backend Module Organization

**Decision**: Follow `integrations/meta/` module pattern — split into actions.ts, queries.ts, types.ts, etc.

**Evidence from codebase**:
- `convex/integrations/meta/` has 6 files: actions.ts, queries.ts, webhook.ts, provider.ts, security.ts, types.ts
- `convex/ai/` has 13 files organized by responsibility
- API paths generated as: `api.integrations.meta.actions.sendMessage`
- Internal functions accessed via: `internal.integrations.meta.actions.handleOAuthCallback`

**Extraction Structure**:
```
packages/backend/convex/integrations/shopify/
├── actions.ts          (OAuth, import, sync actions)
├── queries.ts          (getConnectionStatus, getConnection*)
├── mutations.ts        (saveConnection, updateSyncStatus, etc.)
├── webhooks.ts         (handleWebhook, product/order webhook handlers)
├── orders.ts           (createOrder, createOrderInternal)
├── products.ts         (importProducts, syncProducts, upsertProduct*)
├── types.ts            (TypeScript types)
└── utils.ts            (normalizeShopUrl, helpers)

packages/backend/convex/orders/
├── actions.ts          (generatePaymentLink)
├── queries.ts          (get, getByConversation, listByBusiness, listByCustomer)
├── mutations.ts        (create, addItem, removeItem, updateItemQuantity, status transitions)
├── payments.ts         (Stripe payment link generation, updatePaymentStatus)
├── shopify.ts          (Shopify order creation integration)
└── types.ts            (OrderItem type, etc.)

packages/backend/convex/http/
├── index.ts            (httpRouter, route registration)
├── callbacks/
│   ├── shopify.ts      (Shopify OAuth callback)
│   └── meta.ts         (Meta OAuth callback)
├── webhooks/
│   ├── shopify.ts      (Shopify webhook handler)
│   ├── meta.ts         (Meta webhook handler)
│   ├── whatsapp.ts     (WhatsApp webhook handler)
│   └── stripe.ts       (Stripe webhook handler)
└── crypto.ts           (verifyShopifySignature, verifyStripeSignature, sha256)
```

### API Compatibility

**Decision**: Maintain backward compatibility via re-exports where needed

**Strategy**:
1. Move functions to new subdirectory modules
2. Convex auto-generates new API paths: `api.integrations.shopify.actions.importProducts`
3. Update all imports in codebase to use new paths
4. For `shopify.ts` → `integrations/shopify/`: This is a **breaking change** (API path changes)
5. For `orders.ts` → `orders/`: Can maintain same API if using index.ts re-exports
6. For `http.ts` → `http/`: Internal only, no API compatibility concerns

## Research Findings

### Frontend Component Extraction Pattern

From existing `message-bubble.tsx`:
```typescript
// Clean interface
interface MessageBubbleProps {
  sender: "customer" | "ai" | "human";
  content: string;
  timestamp: number;
  mediaUrl?: string;
}

export function MessageBubble({ sender, content, timestamp, mediaUrl }: MessageBubbleProps) {
  // Component logic
}
```

From existing `product-form.tsx`:
```typescript
// Complex component with mutations
export function ProductForm({ businessId, mode, productId, initialData, onSuccess }: ProductFormProps) {
  const form = useForm({ ... });
  const createProduct = useMutation(api.products.create);
  // Form logic with toast notifications
}
```

### Backend Module Pattern

From `integrations/meta/actions.ts`:
```typescript
import { internal } from "../../_generated/api";
import { action, internalAction, internalMutation, internalQuery } from "../../_generated/server";

// Public action
export const startOAuth = action({ ... });

// Internal query (used by actions)
export const verifyBusinessOwnership = internalQuery({ ... });

// Internal mutation (used by actions/other modules)
export const saveConnection = internalMutation({ ... });
```

Cross-module references:
```typescript
// From one module, calling another module's internal function
await ctx.runQuery(internal.integrations.meta.actions.verifyBusinessOwnership, { businessId });
```

### HTTP Router Pattern

Current pattern in `http.ts`:
```typescript
import { httpRouter } from "convex/server";
const http = httpRouter();

http.route({
  path: "/webhook/shopify",
  method: "POST",
  handler: httpAction(async (ctx, request) => { ... }),
});

export default http;
```

**Key insight**: httpRouter must be in a single file that exports `default http`. Handler functions can be extracted but the router definition must remain centralized.

## Open Questions

1. **API Path Changes**: Moving `shopify.ts` to `integrations/shopify/` will change API paths. Should we:
   - Accept the breaking change and update all frontend imports?
   - Create a compatibility shim in the old location?
   - **Recommended**: Accept breaking change, update imports (cleaner long-term)

2. **http.ts Refactoring**: The crypto utilities (sha256, HMAC) are duplicated/complex. Should we:
   - Extract to a shared `lib/crypto.ts`?
   - Keep inline for simplicity?
   - **Recommended**: Extract to `lib/crypto.ts` for reuse

3. **Test Strategy**: No test framework is configured. Should we:
   - Add Vitest and write tests?
   - Use manual verification only?
   - **Recommended**: Manual verification with browser tests (per PRD)

## Scope Boundaries

**INCLUDE**:
- Split all 6 files into <500 line modules
- Maintain all existing functionality
- Update all imports to use new paths
- Pass type checks (`bun run check-types`)
- Browser verification of UI functionality

**EXCLUDE**:
- Adding new features
- Changing business logic
- Adding test framework (unless explicitly requested)
- Refactoring other files not listed
- Performance optimization

## Guardrails

1. **NO functional changes** — Only structural reorganization
2. **Preserve all exports** — Every currently exported function must remain accessible
3. **Maintain type safety** — All TypeScript types must be preserved
4. **Follow existing patterns** — Use conventions from `integrations/meta/` and `@/components/conversation/`
5. **Atomic commits** — Each file refactoring should be a separate commit
6. **Browser tests required** — Verify UI functionality after frontend changes

## Acceptance Criteria Summary

| File | Current | Target | Components/Modules |
|------|---------|--------|-------------------|
| `customers/$customerId.tsx` | 1,674 | ~150 | 8 extracted components |
| `settings.tsx` | 736 | ~80 | 8 extracted components |
| `conversations.$conversationId.tsx` | 613 | ~80 | 1 extracted component |
| `shopify.ts` | 1,989 | N/A | 8 modules in `integrations/shopify/` |
| `http.ts` | 754 | ~100 | 6 modules in `http/` directory |
| `orders.ts` | 838 | N/A | 6 modules in `orders/` directory |

## Verification Commands

```bash
# Type checking
bun run check-types

# Lint/format check
bun run check

# Dev server for browser testing
bun run dev
```

## Browser Tests Required

1. Navigate to `/customers/[id]`, verify all 5 tabs render and switch correctly
2. Navigate to `/settings`, verify all 4 settings sections render
3. Navigate to `/conversations/[id]`, verify message list, input, and customer panel render
