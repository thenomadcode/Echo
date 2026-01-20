# AGENTS.md - Echo Codebase Guide

> For AI coding agents operating in this repository.

## Project Overview

Echo is a Turborepo monorepo using the Better-T-Stack: TanStack Start + Convex + Better-Auth.

### What is Echo?

Echo is a **WhatsApp AI customer service platform** for small-medium businesses in Latin America. It automates customer interactions so business owners don't have to manually respond to every message.

**Target customers**: Restaurants, pharmacies, retail stores in LATAM (Colombia, Brazil, Mexico)

**Core value proposition**: Business owners connect their WhatsApp Business number, add their product catalog, and Echo's AI handles customer inquiries and orders 24/7.

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
- **Spanish** (es) - LATAM market
- **Portuguese** (pt) - Brazil market

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

// Regular imports
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
```

### Path Aliases
- `@/*` - Maps to `apps/web/src/*`
- `@echo/backend` - Backend package
- `@echo/env` - Environment package
- `@echo/config` - Config package

### React Components
```typescript
// Function components only (no class components)
// Use default export for page/route components
export default function Header() { ... }

// Use named exports for UI components
export function Button({ ... }: Props) { ... }
export { Button, buttonVariants };
```

### Component Patterns
- Use CVA (class-variance-authority) for component variants
- Use `cn()` utility from `@/lib/utils` for className merging
- Use Base UI primitives for accessible components
- shadcn/ui components live in `apps/web/src/components/ui/`
- Prefer using existing shadcn/ui components over building custom ones

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

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev | `bun run dev` |
| Type check | `bun run check-types` |
| Build | `bun run build` |
| Add dependency | `bun add <pkg>` in workspace |
| Convex deploy | `bunx convex deploy` in backend |
