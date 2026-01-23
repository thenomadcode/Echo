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
- **Content-first architecture**: All marketing content in Markdown/MDX files
- Configure Cloudflare deployment via Alchemy
- Set up content collections structure for future pages
- Integrate with Turborepo build system

## Content Philosophy
The marketing site should be **MDX-first**:
- All page content lives in `.mdx` files, not hardcoded in components
- Layouts and components provide structure, MDX provides content
- Non-developers can edit content without touching code
- Easy to add new pages by creating new `.mdx` files
- Version-controlled content with git history

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

### Story 4: shadcn/ui Integration
**As a** developer  
**I want** shadcn/ui configured for Astro  
**So that** I can use the same component library as the main app

**Acceptance Criteria:**
- [ ] `@astrojs/react` integration installed and configured
- [ ] `components.json` configured for Astro (matching `apps/web` style)
- [ ] `src/components/ui/` directory with `button.tsx` as starter component
- [ ] `cn()` utility in `src/lib/utils.ts`
- [ ] React 19 + types installed
- [ ] Components hydrate correctly with `client:load` directive
- [ ] CVA (class-variance-authority) installed for component variants

### Story 5: Content Collections Setup (MDX-First)
**As a** developer  
**I want** Astro content collections configured for MDX content  
**So that** all marketing content is managed via Markdown files

**Acceptance Criteria:**
- [ ] `@astrojs/mdx` integration installed and configured
- [ ] `src/content/config.ts` with collection schemas using Zod
- [ ] Collections defined: `pages`, `features`, `testimonials`, `changelog`, `faq`, `legal`
- [ ] Each collection has appropriate Zod schema with frontmatter validation
- [ ] Empty placeholder `.mdx` files in each collection directory
- [ ] Dynamic routes configured to render MDX content (e.g., `/[...slug].astro`)
- [ ] MDX components can use shadcn/ui React components
- [ ] Supports custom components in MDX (callouts, cards, etc.)

### Story 6: Cloudflare Deployment
**As a** developer  
**I want** the marketing site deployable to Cloudflare  
**So that** it follows the same deployment pattern as `apps/web`

**Acceptance Criteria:**
- [ ] `@astrojs/cloudflare` adapter installed and configured
- [ ] `astro.config.mjs` with Cloudflare output settings
- [ ] `packages/infra/alchemy.run.ts` updated to deploy marketing site
- [ ] Separate deployment from web app (different Worker/Pages)
- [ ] Environment bindings configured (if any needed)

### Story 7: Turborepo Integration
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
| Framework | Astro 6 beta (GA imminent) |
| UI Components | shadcn/ui (React islands) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` |
| Content | Astro Content Collections + MDX |
| Build | Vite 7.x (Astro default) |
| Deployment | Cloudflare Pages via Alchemy |
| Package Manager | Bun |

### Directory Structure
```
apps/marketing/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── components.json          # shadcn/ui configuration
├── .gitignore
├── public/
│   ├── robots.txt
│   └── images/              # Static images
│       └── .gitkeep
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components (React)
│   │   │   ├── button.tsx
│   │   │   └── .gitkeep
│   │   ├── mdx/             # Custom MDX components
│   │   │   ├── Callout.astro
│   │   │   ├── FeatureGrid.astro
│   │   │   └── .gitkeep
│   │   └── .gitkeep
│   ├── content/
│   │   ├── config.ts        # Collection schemas (Zod)
│   │   ├── pages/           # Main pages (about, pricing, etc.)
│   │   │   └── .gitkeep
│   │   ├── features/        # Feature descriptions
│   │   │   └── .gitkeep
│   │   ├── testimonials/    # Customer quotes
│   │   │   └── .gitkeep
│   │   ├── changelog/       # Release notes
│   │   │   └── .gitkeep
│   │   ├── faq/             # FAQ items
│   │   │   └── .gitkeep
│   │   ├── legal/           # Privacy, terms, etc.
│   │   │   └── .gitkeep
│   │   └── pricing/         # Pricing tiers
│   │       └── .gitkeep
│   ├── layouts/
│   │   ├── BaseLayout.astro       # HTML shell, head, scripts
│   │   ├── PageLayout.astro       # Standard page with header/footer
│   │   └── LegalLayout.astro      # Legal pages (simpler)
│   ├── lib/
│   │   └── utils.ts         # cn() utility for Tailwind
│   ├── pages/
│   │   ├── index.astro            # Homepage (placeholder for now)
│   │   ├── [...slug].astro        # Dynamic route for pages collection
│   │   ├── changelog/
│   │   │   └── [...slug].astro    # Changelog entries
│   │   └── legal/
│   │       └── [...slug].astro    # Legal pages
│   └── styles/
│       └── global.css       # Tailwind + CSS variables
```

### Content → Route Mapping
| Content File | Route |
|--------------|-------|
| `content/pages/about.mdx` | `/about` |
| `content/pages/pricing.mdx` | `/pricing` |
| `content/legal/privacy.mdx` | `/legal/privacy` |
| `content/changelog/2026-01-15.mdx` | `/changelog/2026-01-15` |

### Dependencies
```json
{
  "dependencies": {
    "astro": "^6.0.0-beta.2",
    "@astrojs/cloudflare": "^13.0.0-beta.1",
    "@astrojs/mdx": "^5.0.0-beta.1",
    "@astrojs/react": "^4.2.0",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1",
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.525.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.8",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "tailwindcss": "^4.1.3",
    "typescript": "catalog:"
  }
}
```

> **Note**: Using Astro 6 beta with matching beta versions of integrations.
> Once Astro 6 GA releases (expected weeks after Jan 2026), update to stable versions.

### shadcn/ui Integration
shadcn/ui has **official Astro support** (`ui.shadcn.com/docs/installation/astro`).

**Setup:**
1. Configure `components.json` for Astro (same as `apps/web`)
2. Add React integration (`@astrojs/react`)
3. Use `client:load` or `client:visible` directives for interactive components
4. Static content remains zero-JS

**Component Sharing Strategy:**
- Copy base components from `apps/web/src/components/ui/`
- Or use shadcn CLI: `npx shadcn@latest add button dialog ...`
- Components work identically but hydrate only when needed

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

All content is MDX with typed frontmatter. The body of each `.mdx` file contains the actual content.

### `pages` collection
```typescript
// For standalone pages like /about, /pricing, /contact
// File: src/content/pages/about.mdx
// Route: /about
{
  title: z.string(),
  description: z.string(),  // SEO meta description
  draft: z.boolean().default(false),
  template: z.enum(["default", "wide", "centered"]).default("default"),
}
```

**Example MDX:**
```mdx
---
title: "About Echo"
description: "Learn about Echo's mission to empower LATAM businesses"
template: "centered"
---

# About Echo

Echo was founded to help small businesses in Latin America...

<FeatureGrid>
  <Feature icon="clock" title="24/7 Support" />
  <Feature icon="brain" title="Smart AI" />
</FeatureGrid>
```

### `features` collection
```typescript
// For feature cards on homepage/features page
// File: src/content/features/ai-responses.mdx
{
  title: z.string(),
  description: z.string(),  // Short tagline
  icon: z.string(),         // Lucide icon name
  order: z.number(),
  category: z.enum(["ai", "integration", "management"]).optional(),
}
```

### `testimonials` collection
```typescript
// For customer testimonials
// File: src/content/testimonials/restaurant-owner.mdx
{
  name: z.string(),
  company: z.string(),
  role: z.string(),
  avatar: z.string().optional(),  // Path to image
  rating: z.number().min(1).max(5).optional(),
  featured: z.boolean().default(false),
}
// Body contains the quote in MDX
```

### `changelog` collection
```typescript
// For product updates / release notes
// File: src/content/changelog/2026-01-15.mdx
{
  version: z.string(),
  date: z.coerce.date(),
  title: z.string(),
  tags: z.array(z.string()).optional(),  // ["feature", "bugfix", "improvement"]
}
// Body contains detailed release notes
```

### `faq` collection
```typescript
// For FAQ items (renders as accordion)
// File: src/content/faq/pricing-questions.mdx
{
  question: z.string(),
  category: z.enum(["general", "pricing", "technical", "integration"]),
  order: z.number(),
}
// Body contains the answer
```

### `legal` collection
```typescript
// For legal pages (privacy, terms, etc.)
// File: src/content/legal/privacy-policy.mdx
{
  title: z.string(),
  lastUpdated: z.coerce.date(),
  slug: z.string(),  // URL path
}
// Body contains full legal text
```

### `pricing` collection (optional - could be JSON)
```typescript
// For pricing tiers
// File: src/content/pricing/pro.mdx
{
  name: z.string(),
  price: z.number(),           // Monthly price in cents
  currency: z.string(),        // "USD", "COP", "BRL"
  interval: z.enum(["month", "year"]),
  popular: z.boolean().default(false),
  features: z.array(z.string()),
  cta: z.string(),             // Button text
  ctaLink: z.string(),         // Button URL
}
// Body contains additional plan details
```

## Custom MDX Components

These components can be used inside any `.mdx` file without imports (auto-injected):

### `<Callout>` - Info/warning boxes
```mdx
<Callout type="info">
  Echo supports Spanish, Portuguese, and English out of the box.
</Callout>
```

### `<FeatureGrid>` - Grid of features
```mdx
<FeatureGrid>
  <Feature icon="clock" title="24/7 Support" description="..." />
  <Feature icon="brain" title="Smart AI" description="..." />
</FeatureGrid>
```

### `<CTA>` - Call to action button
```mdx
<CTA href="/signup" variant="primary">Get Started Free</CTA>
```

### `<PricingTable>` - Renders pricing collection
```mdx
<PricingTable />
```

### `<FAQ>` - Renders FAQ accordion from collection
```mdx
<FAQ category="pricing" />
```

### `<Testimonials>` - Renders testimonial carousel
```mdx
<Testimonials featured={true} limit={3} />
```

> **Note:** These are Astro components (`.astro`) that wrap React islands when interactivity is needed.

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
- Future CMS integration? (Keystatic, Tina, Decap for git-based editing UI)
- Should we add a `/blog` collection for content marketing later?

## Implementation Notes

### Why Astro over TanStack Start?
1. **Static-first** - Marketing pages don't need SSR or hydration
2. **Zero JS by default** - Faster loads, better SEO
3. **Content Collections** - Native MDX/Markdown with type-safe schemas
4. **Cloudflare native** - First-class support (especially post-acquisition)
5. **Simpler** - Less boilerplate than full React SSR framework

### MDX-First Content Strategy
```
┌─────────────────────────────────────────────────────────┐
│  Content (MDX files)                                    │
│  - Easy to edit                                         │
│  - Version controlled                                   │
│  - Non-developers can contribute                        │
├─────────────────────────────────────────────────────────┤
│  Layouts (Astro)                                        │
│  - Page structure                                       │
│  - Navigation, footer                                   │
│  - SEO meta tags                                        │
├─────────────────────────────────────────────────────────┤
│  Components (Astro + React islands)                     │
│  - Reusable UI elements                                 │
│  - Interactive features (modals, forms)                 │
│  - shadcn/ui integration                                │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- Add new page = create new `.mdx` file
- Update content = edit markdown, no code changes
- Type-safe frontmatter = catch errors at build time
- Custom components = rich content without leaving markdown

### Astro + Cloudflare Post-Acquisition
As of January 2026, Cloudflare owns Astro. Benefits:
- Dedicated integration support
- Astro 6 optimized for Cloudflare Workers/Pages
- Long-term framework sustainability
- Astro remains MIT-licensed and multi-platform
