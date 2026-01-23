# 11 - Marketing Site Scaffold (Astro) - Product Requirements Document

## Overview
Create an empty Astro-based marketing site scaffold at `apps/marketing` for Echo's public-facing marketing website, integrated into the existing Turborepo monorepo with Cloudflare deployment via Alchemy.

## Problem Statement
Echo needs a marketing website to:
1. Present the product value proposition to potential customers
2. Display pricing and features
3. Funnel visitors to the main app for signup

The main app (`apps/web`) handles authentication, dashboard, and business logic. A separate marketing site allows:
- Faster page loads (static-first, zero JS by default)
- SEO optimization without app complexity
- Content-driven pages (MDX/Markdown)
- Independent deployment and iteration

## Goals
- Create an empty Astro scaffold matching the monorepo patterns
- Reuse the same design system (Tailwind v4, same color tokens)
- Configure Cloudflare deployment via Alchemy
- Set up content collections structure for future pages
- Integrate with Turborepo build system

## Non-Goals (Out of Scope)
- Actual marketing content (landing page, pricing, features)
- Blog implementation
- Analytics integration
- Contact forms
- Any dynamic functionality

## User Stories

### Story 1: Project Scaffold
**As a** developer  
**I want** an Astro project in `apps/marketing`  
**So that** I can build marketing pages with the same tooling as the rest of the monorepo

**Acceptance Criteria:**
- [ ] `apps/marketing` directory exists with Astro 6 (latest)
- [ ] `package.json` with correct name, scripts, dependencies
- [ ] TypeScript configuration matching monorepo standards
- [ ] `.gitignore` for Astro-specific files
- [ ] Dev server runs on port 3003 (avoiding conflicts with web:3001, fumadocs:4000)
- [ ] `bun run dev` works from project root via Turborepo

### Story 2: Tailwind v4 Integration
**As a** developer  
**I want** the same Tailwind v4 setup as `apps/web`  
**So that** the marketing site matches the app's design system

**Acceptance Criteria:**
- [ ] Tailwind v4 configured via `@tailwindcss/vite`
- [ ] Same CSS variables (colors, spacing, radii) as `apps/web/src/index.css`
- [ ] Same font families (DM Sans, Plus Jakarta Sans, JetBrains Mono)
- [ ] Dark mode support via `.dark` class
- [ ] `cn()` utility available from `src/lib/utils.ts`

### Story 3: Base Layout & Components
**As a** developer  
**I want** a minimal base layout structure  
**So that** I have a starting point for marketing pages

**Acceptance Criteria:**
- [ ] `src/layouts/BaseLayout.astro` with HTML boilerplate
- [ ] Proper `<head>` with meta tags, fonts, CSS
- [ ] Theme script for dark mode persistence
- [ ] Empty `src/components/` directory for future components
- [ ] `src/pages/index.astro` with minimal "Coming Soon" placeholder

### Story 4: Content Collections Setup
**As a** developer  
**I want** Astro content collections configured  
**So that** I can add MDX-based marketing pages later

**Acceptance Criteria:**
- [ ] `src/content/config.ts` with collection schemas
- [ ] Collections defined: `pages`, `features`, `testimonials`, `changelog`
- [ ] Each collection has appropriate Zod schema
- [ ] Empty placeholder files in each collection directory
- [ ] MDX support configured

### Story 5: Cloudflare Deployment
**As a** developer  
**I want** the marketing site deployable to Cloudflare  
**So that** it follows the same deployment pattern as `apps/web`

**Acceptance Criteria:**
- [ ] `@astrojs/cloudflare` adapter installed and configured
- [ ] `astro.config.mjs` with Cloudflare output settings
- [ ] `packages/infra/alchemy.run.ts` updated to deploy marketing site
- [ ] Separate deployment from web app (different Worker/Pages)
- [ ] Environment bindings configured (if any needed)

### Story 6: Turborepo Integration
**As a** developer  
**I want** the marketing site integrated with Turborepo  
**So that** it builds and runs with the rest of the monorepo

**Acceptance Criteria:**
- [ ] `turbo.json` recognizes `apps/marketing` automatically (via `apps/*` glob)
- [ ] `bun run dev` starts marketing dev server
- [ ] `bun run build` builds marketing site
- [ ] Build outputs to correct directory for Cloudflare
- [ ] Root `package.json` has `dev:marketing` script (optional convenience)

## Technical Requirements

### Framework
- Astro 6.x (latest beta/stable)
- TypeScript strict mode
- Vite as build tool (Astro default)

### Stack
| Component | Choice |
|-----------|--------|
| Framework | Astro 6 |
| Styling | Tailwind CSS v4 |
| Content | Astro Content Collections + MDX |
| Build | Vite |
| Deployment | Cloudflare Pages via Alchemy |
| Package Manager | Bun |

### Directory Structure
```
apps/marketing/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── .gitignore
├── public/
│   └── robots.txt
├── src/
│   ├── components/
│   │   └── .gitkeep
│   ├── content/
│   │   ├── config.ts
│   │   ├── pages/
│   │   │   └── .gitkeep
│   │   ├── features/
│   │   │   └── .gitkeep
│   │   ├── testimonials/
│   │   │   └── .gitkeep
│   │   └── changelog/
│   │       └── .gitkeep
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── lib/
│   │   └── utils.ts
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
```

### Dependencies
```json
{
  "dependencies": {
    "astro": "^6.0.0",
    "@astrojs/cloudflare": "^12.0.0",
    "@astrojs/mdx": "^4.0.0",
    "@astrojs/tailwind": "^6.0.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.8",
    "tailwindcss": "^4.1.3",
    "typescript": "catalog:"
  }
}
```

### Alchemy Configuration Update
```typescript
// packages/infra/alchemy.run.ts
import { AstroSite } from "alchemy/cloudflare"; // or appropriate Astro adapter

export const marketing = await AstroSite("marketing", {
  cwd: "../../apps/marketing",
  // No env bindings needed for static marketing site
});

console.log(`Marketing -> ${marketing.url}`);
```

## Data Model
N/A - Marketing site is static with no database.

## Content Collection Schemas

### `pages` collection
```typescript
// For standalone pages like /about, /pricing
{
  title: z.string(),
  description: z.string(),
  draft: z.boolean().default(false),
}
```

### `features` collection
```typescript
// For feature showcase sections
{
  title: z.string(),
  description: z.string(),
  icon: z.string(), // Lucide icon name
  order: z.number(),
}
```

### `testimonials` collection
```typescript
// For customer testimonials
{
  name: z.string(),
  company: z.string(),
  role: z.string(),
  quote: z.string(),
  avatar: z.string().optional(),
}
```

### `changelog` collection
```typescript
// For product updates
{
  version: z.string(),
  date: z.date(),
  title: z.string(),
}
```

## UI/UX

### Placeholder Page
The `index.astro` should display:
- Echo logo
- "Coming Soon" or "Marketing Site" text
- Link to main app (`https://app.echo.com` or appropriate URL)

### Design System
Copy these from `apps/web/src/index.css`:
- CSS custom properties (colors, spacing, radii)
- Font imports
- Dark mode variables
- Base layer styles

## Success Metrics
- Dev server starts in < 2 seconds
- Production build completes in < 10 seconds
- Lighthouse score > 95 on placeholder page
- Zero TypeScript errors
- Deploys successfully to Cloudflare

## Dependencies
- Astro 6 (newly Cloudflare-owned, excellent integration)
- Existing Turborepo setup
- Existing Alchemy deployment infrastructure
- Tailwind v4 patterns from `apps/web`

## Open Questions
- Should the marketing site share the `@echo/config` TypeScript config package?
- Custom domain setup (e.g., `echo.com` vs `app.echo.com`)?
- Should we use Astro's View Transitions for page navigation?
- Do we need Astro's image optimization, or will images be served from CDN?

## Implementation Notes

### Why Astro over TanStack Start?
1. **Static-first** - Marketing pages don't need SSR or hydration
2. **Zero JS by default** - Faster loads, better SEO
3. **Content Collections** - Native MDX/Markdown with type-safe schemas
4. **Cloudflare native** - First-class support (especially post-acquisition)
5. **Simpler** - Less boilerplate than full React SSR framework

### Astro + Cloudflare Post-Acquisition
As of January 2026, Cloudflare owns Astro. Benefits:
- Dedicated integration support
- Astro 6 optimized for Cloudflare Workers/Pages
- Long-term framework sustainability
- Astro remains MIT-licensed and multi-platform
