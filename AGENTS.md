# AGENTS.md - Echo Codebase Guide

> For AI coding agents operating in this repository.

## Project Overview

Echo is a Turborepo monorepo using the Better-T-Stack: TanStack Start + Convex + Better-Auth.

### Tech Stack
- **Runtime**: Bun 1.3.6
- **Frontend**: React 19, TanStack Router/Start (SSR), Tailwind CSS v4
- **Backend**: Convex (reactive BaaS)
- **Auth**: Better-Auth with Convex adapter
- **UI**: Base UI + shadcn/ui components, CVA for variants
- **Deployment**: Cloudflare via Alchemy

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
