# AGENTS.md - Echo Codebase Guide

> For AI coding agents operating in this repository.

## Project Overview

Echo is a Turborepo monorepo using the Better-T-Stack: TanStack Start + Convex + Better-Auth.

### What is Echo?

Echo is an **AI-powered sales assistant** for creators, influencers, and online sellers. It automates customer conversations so you can sell 24/7 without being glued to your inbox.

**Target customers**: Instagram influencers, content creators, e-commerce sellers, coaches, service providers - anyone selling products or services through messaging.

**Core value proposition**: Connect your messaging channels, add your products/services, and Echo's AI handles customer inquiries, answers questions, and closes sales around the clock.

### Key Business Domains

| Domain | Description |
|--------|-------------|
| **Multi-tenancy** | One user can own multiple businesses. Each business has isolated data. |
| **Product Catalog** | Businesses manage products with prices, categories, images, availability. |
| **WhatsApp Integration** | Connect via BSP (Twilio/360dialog) to receive/send messages. |
| **AI Conversations** | AI understands intent, answers questions, helps with orders. |
| **Order Management** | Customers place orders via chat, businesses fulfill them. |

### User Flow

```
Customer (WhatsApp) → Echo AI → Response
                         ↓
                   [If needed]
                         ↓
               Business Owner (Dashboard)
```

### Supported Languages

- **English** (en) - Primary, default
- **Spanish** (es) - Global Spanish speakers
- **Portuguese** (pt) - Brazilian market

AI auto-detects language from customer's first message and responds in same language.

### Currency & Pricing

- Store prices in **smallest currency unit** (centavos) as integers
- Supported currencies: COP (Colombia), BRL (Brazil), MXN (Mexico), USD
- Default currency inherited from business settings

### Timestamps & Timezone

- Store all timestamps in **UTC**
- UI converts to user's local timezone for display
- Default business timezone: UTC

### Feature Roadmap (PRDs in `tasks/` folder)

1. **Business Onboarding** - Sign up, create business profile, settings
2. **Product CMS** - Add/edit products, categories, bulk operations
3. **WhatsApp Integration** - Connect number, receive/send messages
4. **AI Conversation Engine** - Intent classification, response generation
5. **Order Flow** - Cart, checkout, order tracking
6. **Conversation Dashboard** - View/manage conversations, escalations
7. **Shopify Sync** - Import products from Shopify

### Tech Stack
- **Runtime**: Bun 1.3.6
- **Frontend**: React 19, TanStack Router/Start (SSR), Tailwind CSS v4
- **Backend**: Convex (reactive BaaS)
- **Auth**: Better-Auth with Convex adapter
- **UI**: Base UI + shadcn/ui components, CVA for variants
- **Deployment**: Cloudflare via Alchemy
- **AI**: OpenAI API via `openai` npm package

### AI Configuration

- **Default Model**: `gpt-5-nano` (set via `AI_MODEL` env var)
- **SDK**: [openai-node](https://github.com/openai/openai-node) - Official OpenAI TypeScript SDK
- **APIs Used**:
  - **Responses API** (`client.responses.create`) - For gpt-5/o3/o4 models
  - **Chat Completions API** (`client.chat.completions.create`) - For older models and function calling with tools
- **Token Limits**: gpt-5+ models use `max_completion_tokens`, older models use `max_tokens`

### Monorepo Structure
```
echo/
├── apps/
│   ├── web/           # Main app (TanStack Start + React)
│   └── fumadocs/      # Documentation site
├── packages/
│   ├── backend/       # Convex functions and schema
│   ├── env/           # Type-safe environment variables
│   ├── config/        # Shared TypeScript configs
│   └── infra/         # Alchemy deployment config
```

---

## Commands

### Development
```bash
bun run dev              # Start all apps + Convex backend
bun run dev:web          # Start web app only
bun run dev:server       # Start Convex backend only
bun run dev:setup        # Initial Convex project setup
```

### Build & Validation
```bash
bun run build            # Build all packages
bun run check-types      # TypeScript type-checking across monorepo
bun run check            # Biome linter + formatter check
bun run check:fix        # Fix all auto-fixable issues
bun run lint             # Run Biome linter only
bun run lint:fix         # Fix auto-fixable lint issues
```

### Deployment (Cloudflare)
```bash
cd apps/web && bun run alchemy dev    # Local Cloudflare dev
cd apps/web && bun run deploy         # Deploy to Cloudflare
cd apps/web && bun run destroy        # Tear down deployment
```

### Running Individual Package Commands
```bash
turbo -F web <command>         # Run command in web app
turbo -F @echo/backend <command>  # Run command in backend
```

### Tests
No test framework is currently configured. When adding tests, prefer Vitest.

### Browser Testing with Chrome DevTools MCP

**IMPORTANT**: Always test UI changes and user flows using Chrome DevTools MCP whenever possible.

**Why Chrome DevTools MCP?**
- Verifies actual user experience, not just code correctness
- Catches rendering issues, JavaScript errors, and runtime bugs
- Tests real browser interactions (clicks, form fills, navigation)
- Provides screenshots and snapshots for verification
- Faster than manual testing

**When to use Chrome DevTools MCP:**
- After implementing new UI features or components
- After fixing bugs that affect user-facing functionality
- When changes involve user interactions (forms, buttons, navigation)
- To verify error states and edge cases
- Before marking work as complete

**Example workflow:**
```typescript
// 1. Navigate to the page
await navigate_page({ url: "http://localhost:3001/settings" })

// 2. Take snapshot to see current state
await take_snapshot()

// 3. Interact with UI elements
await click({ uid: "button-import-products" })

// 4. Verify expected outcome
await wait_for({ text: "Import successful" })

// 5. Take screenshot for evidence
await take_screenshot({ filePath: "test-result.png" })
```

**Available in**: Chrome DevTools MCP server (pre-configured in this project)

---

## Linting & Formatting

### Biome

Echo uses [Biome](https://biomejs.dev/) for linting and formatting. Biome is a fast, all-in-one toolchain for JavaScript/TypeScript.

**Configuration**: See `biome.json` in the project root.

**VS Code Integration**: Auto-format on save is configured in `.vscode/settings.json`. Install the Biome extension (recommended in `.vscode/extensions.json`).

**Ignored Files**:
- Third-party UI components (`apps/web/src/components/ui/**`)
- Generated files (`**/*.gen.ts`, `**/_generated/**`)
- Documentation apps (`apps/fumadocs/**`, `apps/marketing/**`)
- Deployment scripts (`packages/infra/**`)

### Git Hooks

**Pre-commit** (runs on `git commit`):
- `biome check` on staged files
- `bun run check-types` on TypeScript files

**Pre-push** (runs on `git push`):
- Full `bun run check` (linter + formatter)
- Full `bun run check-types`
- Full `bun run build`

**Managed by**: [Lefthook](https://github.com/evilmartians/lefthook) - see `lefthook.yml` for configuration.

**Bypass hooks** (use sparingly): `git commit --no-verify`

---

## TypeScript Configuration

### Strict Settings (enforced)
- `strict: true`
- `noUncheckedIndexedAccess: true` - Array/object access may be undefined
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `verbatimModuleSyntax: true` - Use `import type` for type-only imports

### Module System
- Target: `ESNext`
- Module: `ESNext` with `bundler` resolution
- All packages use `"type": "module"`

---

## Code Style Guidelines

### Imports
```typescript
// Type imports MUST use `import type`
import type { QueryClient } from "@tanstack/react-query";
import type { VariantProps } from "class-variance-authority";

// Named imports (preferred for all UI components and utilities)
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
```

### Path Aliases
- `@/*` - Maps to `apps/web/src/*`
- `@echo/backend` - Backend package
- `@echo/env` - Environment package
- `@echo/config` - Config package

### React Components
```typescript
// Function components only (no class components)

// UI components: ALWAYS use named exports
export function Header() { ... }
export function Button({ ... }: Props) { ... }
export { Button, buttonVariants };

// Route components: Use named export of Route constant (TanStack Router requirement)
export const Route = createFileRoute("/path")({
  component: RouteComponent,
});
```

### Component Patterns
- Use CVA (class-variance-authority) for component variants
- Use `cn()` utility from `@/lib/utils` for className merging
- Use Base UI primitives for accessible components
- shadcn/ui components live in `apps/web/src/components/ui/`
- Prefer using existing shadcn/ui components over building custom ones

### Custom Hooks
```typescript
// Business context: Active business with localStorage persistence
const { activeBusinessId, setActiveBusinessId, currency, timezone } = useBusinessContext();

// Pagination: Handles currentPage, totalPages, navigation
const pagination = usePagination({ totalItems, itemsPerPage: 10 });

// Debounce: Delays value updates (search inputs, etc)
const debouncedSearch = useDebounce(searchTerm, 300);

// Convex mutations: Automatic error toast handling
const updateProduct = useConvexMutation(api.products.update);
await updateProduct({ id, name: "New" }, { errorMessage: "Failed to update" });
```

**Location**: `apps/web/src/hooks/`
- `use-business-context.tsx` - BusinessProvider wraps _authenticated routes
- `use-pagination.ts` - Replaces manual currentPage/totalPages useState
- `use-debounce.ts` - For search inputs and frequently changing values
- `use-convex-mutation.ts` - Wraps useMutation with toast.error

### Forms
```typescript
// Use @tanstack/react-form with Zod validators
const form = useForm({
  defaultValues: { email: "", password: "" },
  onSubmit: async ({ value }) => { ... },
  validators: {
    onSubmit: z.object({ ... }),
  },
});
```

### Error Handling
- Use `toast.error()` from `sonner` for user-facing errors
- Use `useConvexMutation()` for automatic error toast handling
- Never swallow errors silently
- Validation errors displayed inline with form fields

---

## Convex Backend Patterns

### Query/Mutation Structure
```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},  // Always define args, even if empty
  handler: async (ctx) => {
    // ctx.db for database access
    // Return values must be serializable
  },
});

export const myMutation = mutation({
  args: {
    field: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("table", { ... });
  },
});
```

### Authentication in Convex
```typescript
import { authComponent } from "./auth";

// In handler:
const authUser = await authComponent.safeGetAuthUser(ctx);
if (!authUser) {
  return { message: "Not authenticated" };
}
```

### HTTP Routes
```typescript
import { httpRouter } from "convex/server";
const http = httpRouter();
authComponent.registerRoutes(http, createAuth);
export default http;
```

---

## Environment Variables

Use T3-style type-safe environment validation:

```typescript
// packages/env/src/server.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    // ...
  },
  runtimeEnv: process.env,
});
```

Required env files:
- `packages/backend/.env.local` - Convex environment
- `apps/web/.env` - Web app environment

---

## Routing (TanStack Router)

### File-based Routes
```typescript
// apps/web/src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() { ... }
```

### Route with Auth Check
```typescript
export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    // Auth checks here
  },
});
```

---

## Forbidden Patterns

- `as any`, `@ts-ignore`, `@ts-expect-error` - Fix types properly
- Class components - Use function components
- Empty catch blocks - Handle or log errors
- Committing `.env` files or secrets
- Direct DOM manipulation - Use React patterns
- `console.log` in production code - Remove before commit
- `window.alert()`, `window.confirm()`, `window.prompt()` - Use shadcn AlertDialog or Dialog components instead
- Building custom UI components when shadcn/ui has an equivalent - Always check `apps/web/src/components/ui/` first

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev | `bun run dev` |
| Type check | `bun run check-types` |
| Lint + format check | `bun run check` |
| Lint + format fix | `bun run check:fix` |
| Build | `bun run build` |
| Add dependency | `bun add <pkg>` in workspace |
| Convex deploy | `bunx convex deploy` in backend |

---

## Project Knowledge (ByteRover)

ByteRover is a project-level knowledge repository that persists across sessions. It helps AI agents avoid re-discovering patterns, conventions, and decisions.

### Quick Start

```bash
# Check if ByteRover is running
brv status

# Query existing knowledge before starting work
brv query "How is authentication implemented?"

# Curate new knowledge after completing work
brv curate "Auth uses JWT with 24h expiry in httpOnly cookies" -f apps/web/src/lib/auth.ts
```

### When to Use

**Query before working** to understand:
- Existing patterns and conventions
- Architecture decisions
- Implementation details

**Curate after working** to capture:
- Feature implementations
- Bug fixes and root causes
- Architecture decisions

### Skill Location

ByteRover skills are available in two locations:
- **OpenCode**: `.opencode/skills/byterover/` (primary for OpenCode agents)
- **Claude**: `.claude/skills/byterover/` (for Claude Desktop compatibility)

Both locations contain:
- `SKILL.md` - Quick reference and best practices
- `WORKFLOWS.md` - Detailed usage patterns
- `TROUBLESHOOTING.md` - Error handling guide

**Note**: The skill must be loaded using `load_skills=["byterover"]` when delegating tasks to subagents.
