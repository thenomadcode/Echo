# Design System Redesign - Product Requirements Document

## Overview

Complete visual redesign of Echo following the "Warm Signal" design direction, implementing a global navigation shell, consistent design tokens, and page-by-page UI improvements while keeping all existing functionality intact and shadcn/ui components pure.

## Problem Statement

The current Echo UI has several critical issues:
1. **No visual identity** - Generic template appearance with no brand personality
2. **Duplicated navigation** - Header with BusinessSwitcher + AppNav + UserMenu is copy-pasted across 15+ pages
3. **Inconsistent patterns** - Mix of `window.confirm()`, custom modals, and AlertDialog for confirmations
4. **Poor information density** - `text-xs` everywhere makes content hard to read
5. **Empty dashboard** - No metrics, no activity feed, no value for users
6. **Fragmented settings** - Long scroll with links to separate pages instead of organized sections
7. **No brand differentiation** - Looks like every other SaaS, nothing memorable

## Goals

- Establish "Warm Signal" design direction with terracotta/amber accent colors
- Create global navigation shell with collapsible sidebar
- Redesign all 18 pages while preserving functionality
- Implement consistent patterns for modals, status badges, and spacing
- Support both light and dark themes
- Mobile-first responsive design
- Keep shadcn/ui components untouched (pure)

## Non-Goals (Out of Scope)

- Adding new features or functionality
- Changing the backend/API
- Modifying shadcn/ui component source files
- Implementing animations beyond basic transitions
- Building a component library or Storybook

---

## Design Direction: "Warm Signal"

### Brand Values
| Value | Expression |
|-------|------------|
| **Business-oriented** | Clean hierarchy, professional typography |
| **Smart AI** | Subtle AI indicators, intelligent empty states |
| **Indie/Approachable** | Warm colors, friendly rounded corners |
| **Thoughtful** | Generous spacing, micro-interactions |

### Color Palette

#### Light Mode
```css
--background: oklch(0.985 0.002 90);       /* #FAFAF8 warm off-white */
--foreground: oklch(0.145 0.015 60);       /* #1C1917 warm black */
--primary: oklch(0.58 0.2 35);             /* #EA580C terracotta orange */
--primary-foreground: oklch(0.98 0.01 90); /* white */
--secondary: oklch(0.92 0.04 55);          /* #FED7AA peach cream */
--muted: oklch(0.96 0.005 90);             /* #F5F5F4 stone-50 */
--muted-foreground: oklch(0.55 0.015 60);  /* #78716C stone-500 */
--accent: oklch(0.92 0.04 55);             /* same as secondary */
--destructive: oklch(0.55 0.2 25);         /* red for errors */
--success: oklch(0.6 0.19 145);            /* #16A34A green-600 */
--border: oklch(0.9 0.005 90);             /* #E7E5E4 stone-200 */
--ring: oklch(0.58 0.2 35);                /* same as primary */
```

#### Dark Mode
```css
--background: oklch(0.145 0.015 60);       /* #1C1917 stone-900 */
--foreground: oklch(0.985 0.002 90);       /* #FAFAF9 stone-50 */
--primary: oklch(0.72 0.17 45);            /* #FB923C orange-400 */
--primary-foreground: oklch(0.15 0.02 30); /* dark */
--secondary: oklch(0.25 0.06 30);          /* #431407 orange-950 */
--muted: oklch(0.21 0.01 60);              /* #292524 stone-800 */
--muted-foreground: oklch(0.65 0.01 60);   /* #A8A29E stone-400 */
--border: oklch(0.3 0.01 60 / 0.5);        /* white 10% opacity */
```

### Typography

| Usage | Font | Weight | Size |
|-------|------|--------|------|
| **Headlines** | Plus Jakarta Sans | 600-700 | 24-32px |
| **Subheadings** | Plus Jakarta Sans | 600 | 18-20px |
| **Body** | DM Sans | 400 | 15-16px |
| **Small/Labels** | DM Sans | 500 | 13-14px |
| **Monospace** | JetBrains Mono | 400 | 14px |

### Spacing Scale
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### Border Radius
```css
--radius-sm: 6px;
--radius-md: 10px;   /* default */
--radius-lg: 16px;
--radius-full: 9999px;
```

---

## User Stories

### Story 1: Global Navigation Shell
**As a** business owner  
**I want** consistent navigation across all pages  
**So that** I can easily move between sections without confusion

**Acceptance Criteria:**
- [ ] Create `_authenticated.tsx` layout route that wraps all authenticated pages
- [ ] Implement collapsible sidebar (64px icons-only → 240px expanded on hover)
- [ ] Sidebar contains: Logo, nav items (Dashboard, Conversations, Orders, Products, Settings), collapse toggle
- [ ] Header contains: BusinessSwitcher, Command Palette trigger (⌘K), NotificationBell, UserMenu
- [ ] Mobile: Bottom tab bar with 5 main items, hamburger for full menu
- [ ] Remove duplicated navigation from all 15+ pages
- [ ] Sidebar remembers collapsed/expanded state in localStorage

**Technical Notes:**
- Use CSS `width` transition for smooth collapse animation
- Sidebar nav items from existing `app-nav.tsx`
- Business switcher moves to header on desktop, stays in sidebar on mobile

---

### Story 2: Landing Page Redesign
**As a** visitor  
**I want** to understand what Echo does immediately  
**So that** I can decide if I want to sign up

**Acceptance Criteria:**
- [ ] Replace ASCII art with proper Echo logo and tagline
- [ ] Hero section with value proposition: "AI-Powered Customer Service for Your WhatsApp Business"
- [ ] 3 feature cards (bento-style): 24/7 Support, Smart AI, Easy Setup
- [ ] Social proof section: "Trusted by 500+ LATAM businesses"
- [ ] Two CTAs: "Get Started Free" (primary), "Sign In" (secondary/outline)
- [ ] Warm gradient background using brand colors
- [ ] Remove API health check (move to admin/debug page if needed)
- [ ] Mobile: Stack vertically, maintain CTAs above fold

**Technical Notes:**
- No authentication required
- Redirect to /dashboard if already logged in

---

### Story 3: Auth Pages Redesign (Login/Signup)
**As a** user  
**I want** a branded, trustworthy login experience  
**So that** I feel confident using the platform

**Acceptance Criteria:**
- [ ] Split layout: left panel (branding), right panel (form)
- [ ] Left panel: Brand illustration or gradient mesh, testimonial quote, decorative elements
- [ ] Right panel: Echo logo, form fields, submit button, OAuth, switch link
- [ ] Terracotta primary button color
- [ ] Increase spacing between form fields (gap-6)
- [ ] Mobile: Hide left panel, show only form with logo above
- [ ] Error states use destructive color, not plain red
- [ ] Loading state on submit button

**Technical Notes:**
- Forms already work, just visual changes
- Keep existing validation and auth logic

---

### Story 4: Multi-Step Onboarding Wizard
**As a** new user  
**I want** a guided onboarding experience  
**So that** I don't feel overwhelmed setting up my business

**Acceptance Criteria:**
- [ ] Split into 3 steps with progress indicator (circles connected by lines)
- [ ] Step 1 "Business Info": Name, Type, Description
- [ ] Step 2 "Branding": Logo upload (drag-drop), Address
- [ ] Step 3 "Ready": Celebration, summary, next action suggestions
- [ ] Replace logo URL input with ImageUpload component (already exists)
- [ ] Animate transitions between steps
- [ ] Back button on steps 2-3
- [ ] Final step suggests: "Go to Dashboard" or "Connect WhatsApp"
- [ ] Progress saves to state (can refresh without losing data)

**Technical Notes:**
- Use existing `ImageUpload` component from products
- Store step data in React state, submit all at end
- Convex mutation unchanged

---

### Story 5: Dashboard with Metrics
**As a** business owner  
**I want** to see an overview of my business activity  
**So that** I know what needs my attention

**Acceptance Criteria:**
- [ ] Personalized greeting: "Good morning, {userName}! Here's what's happening at {businessName}"
- [ ] Metric cards row (bento grid):
  - Conversations: count active, count escalated (warning if >0)
  - Orders: count new today, revenue today
  - Weekly trend: sparkline chart, % change vs last week
- [ ] Recent Activity feed (last 5 events):
  - New conversation
  - Escalated conversation (highlighted)
  - Order status changes
  - Format: icon + description + relative time
- [ ] Quick Actions sidebar:
  - Add Product
  - Settings
  - Connect WhatsApp (if not connected)
- [ ] Empty state for new businesses: onboarding checklist
- [ ] All cards link to relevant pages

**Technical Notes:**
- Need new Convex query: `dashboard.getMetrics` returning counts
- Activity feed from existing conversation/order data
- Sparkline can use simple SVG or a lightweight chart library

---

### Story 6: Conversations Page Polish
**As a** business owner  
**I want** to quickly scan and manage conversations  
**So that** I can respond to customers efficiently

**Acceptance Criteria:**
- [ ] Increase base text size from `text-xs` to `text-sm`
- [ ] Conversation list items: min-h-20, avatar placeholder with initials, color-coded left border by status
- [ ] Status colors use CSS variables, not hardcoded Tailwind
- [ ] Relative timestamps: "2m ago", "1h ago", "Yesterday"
- [ ] Sticky header with filters
- [ ] Message bubbles: rounded-2xl, proper spacing, visual distinction for customer/AI/human
- [ ] Actions (Take Over, Close, etc.) as icon buttons in header
- [ ] Use AlertDialog for "Hand Back to AI" confirmation (replace window.confirm in mobile view)
- [ ] Empty state: Illustration + "No conversations yet" + explanation

**Technical Notes:**
- StatusBadge component already uses Badge, just update colors
- Mobile route `/conversations/$conversationId` needs AlertDialog fix

---

### Story 7: Orders Page Enhancement
**As a** business owner  
**I want** to manage orders efficiently  
**So that** I can fulfill them quickly

**Acceptance Criteria:**
- [ ] Add search input (by order number or customer phone)
- [ ] Migrate StatusBadge to use shadcn Badge component (not custom span)
- [ ] Add customer phone column to table
- [ ] Relative dates: "Today", "Yesterday", "Jan 15"
- [ ] Row hover shows subtle background
- [ ] Add pagination controls
- [ ] Empty state: Illustration + "No orders yet" + explanation

**Order Detail Page:**
- [ ] Consolidate into 2-column layout (order info left, customer/delivery right)
- [ ] Status badge prominent in header
- [ ] Use AlertDialog for cancel confirmation (replace window.confirm)
- [ ] Link to related conversation if exists
- [ ] Actions as primary buttons at bottom

**Technical Notes:**
- Search can filter client-side initially
- AlertDialog fix at `/orders_.$orderId.tsx:136`

---

### Story 8: Products Page Refinement
**As a** business owner  
**I want** an attractive product catalog view  
**So that** I can manage my offerings with pride

**Acceptance Criteria:**
- [ ] Product cards: larger images (aspect-square), better typography, availability indicator dot
- [ ] Bulk action bar fixed at bottom when items selected (not inline)
- [ ] Use AlertDialog for bulk delete (replace custom inline modal)
- [ ] Use AlertDialog for single product delete (replace custom inline modal)
- [ ] Category management accessible from dropdown in header (not separate page nav)
- [ ] Empty state: Illustration + "Add your first product" + CTA button
- [ ] Grid gap increased to gap-6

**Technical Notes:**
- AlertDialog fixes in `/products/index.tsx` and `/products/$productId.tsx`
- Categories page can remain, but add quick-add from products page

---

### Story 9: Settings Reorganization
**As a** business owner  
**I want** organized, easy-to-navigate settings  
**So that** I can configure my business without endless scrolling

**Acceptance Criteria:**
- [ ] Settings internal sidebar navigation:
  - General: Business Info, Localization, Business Hours
  - AI & Automation: AI Personality, Escalation
  - Integrations: WhatsApp, Shopify
- [ ] Clicking sidebar item shows that section in main content area
- [ ] Save button sticky at bottom of content area
- [ ] WhatsApp settings inline (not separate page)
- [ ] Shopify settings inline (not separate page)
- [ ] AI settings inline (not separate page)
- [ ] Collapsible sections within each settings area
- [ ] Back to main settings works from any sub-route

**Technical Notes:**
- Can implement as tabs or accordion within single page
- Keep sub-routes for deep linking, but render within settings layout
- Existing forms unchanged, just reorganized

---

### Story 10: Consistent Modal Pattern
**As a** developer  
**I want** all confirmation dialogs to use AlertDialog  
**So that** the UX is consistent and accessible

**Acceptance Criteria:**
- [ ] Replace `window.confirm()` in `/orders_.$orderId.tsx:136` with AlertDialog
- [ ] Replace `window.confirm()` in `/conversations_.$conversationId.tsx:157` with AlertDialog
- [ ] Replace inline modal in `/products/$productId.tsx` with AlertDialog
- [ ] Replace inline modal in `/products/index.tsx` (bulk delete) with AlertDialog
- [ ] All AlertDialogs have consistent copy: Title, Description, Cancel, Confirm
- [ ] Destructive actions use `variant="destructive"` on confirm button

**Technical Notes:**
- AlertDialog already imported and used in some places
- Just need to extend usage to remaining locations

---

### Story 11: Status Badge Standardization
**As a** developer  
**I want** consistent status badges across the app  
**So that** status colors are from the design system

**Acceptance Criteria:**
- [ ] Create status color mappings using CSS variables
- [ ] Order StatusBadge uses shadcn Badge component
- [ ] Conversation StatusBadge already correct, verify colors match design system
- [ ] Status colors:
  - Draft/Pending: `secondary` (muted)
  - Active/Confirmed: `default` (primary)
  - Escalated/Warning: `warning` (amber)
  - Paid/Success: `success` (green)
  - Preparing/In Progress: `info` (blue)
  - Ready: `warning` (orange)
  - Delivered/Closed: `success` (teal)
  - Cancelled/Error: `destructive` (red)

**Technical Notes:**
- May need to extend Badge variants in Tailwind config (not component source)
- Use `data-status` attribute for styling if needed

---

### Story 12: Typography and Spacing Audit
**As a** user  
**I want** readable text and comfortable spacing  
**So that** using Echo doesn't strain my eyes

**Acceptance Criteria:**
- [ ] Minimum body text: 15px (not text-xs anywhere for body content)
- [ ] Labels can be 13-14px
- [ ] Line height: 1.5-1.6 for body text
- [ ] Card padding: consistent 24px (p-6)
- [ ] Section gaps: 24-32px
- [ ] Container max-widths standardized:
  - List pages (conversations, orders, products): `max-w-7xl`
  - Detail/form pages: `max-w-4xl`
  - Settings: `max-w-5xl`

**Technical Notes:**
- Audit all routes for text-xs usage
- Create spacing utility classes if needed

---

### Story 13: Dark Mode Verification
**As a** user  
**I want** dark mode to work properly  
**So that** I can use Echo at night comfortably

**Acceptance Criteria:**
- [ ] All new color variables have dark mode equivalents
- [ ] Status badges readable in dark mode
- [ ] Gradient backgrounds work in dark mode
- [ ] Border colors visible but subtle in dark mode
- [ ] No white flashes on page load
- [ ] Images/illustrations work in both modes (or provide alternatives)
- [ ] Form inputs have proper contrast in dark mode

**Technical Notes:**
- Current app has `className="dark"` hardcoded on html element
- Implement proper theme toggle (localStorage + system preference)

---

### Story 14: Mobile Navigation
**As a** mobile user  
**I want** easy navigation on my phone  
**So that** I can manage my business on the go

**Acceptance Criteria:**
- [ ] Bottom tab bar with 5 items: Dashboard, Conversations, Orders, Products, Settings
- [ ] Active tab highlighted with primary color
- [ ] Tab icons same as sidebar
- [ ] Hamburger menu for secondary navigation (account, help, etc.)
- [ ] Touch targets minimum 44px
- [ ] Swipe gestures for conversation list (optional, nice-to-have)
- [ ] Sidebar hidden on mobile (use bottom tabs instead)

**Technical Notes:**
- Use media query or Tailwind responsive classes
- Bottom bar fixed at bottom, z-50
- Content area accounts for bottom bar height

---

## Technical Requirements

### CSS Changes
1. Update `apps/web/src/index.css`:
   - Add Warm Signal color palette as CSS variables
   - Add typography variables
   - Add spacing scale
   - Ensure dark mode variables

2. Update `tailwind.config.ts`:
   - Extend colors to reference CSS variables
   - Add font families (Plus Jakarta Sans, DM Sans)
   - Extend spacing scale if needed

3. Add fonts to `apps/web/src/routes/__root.tsx`:
   - Google Fonts link for Plus Jakarta Sans and DM Sans
   - Or use `@fontsource` packages

### Layout Changes
1. Create `apps/web/src/routes/_authenticated.tsx`:
   - Layout route for all authenticated pages
   - Contains sidebar, header, and Outlet
   - Handles mobile bottom nav

2. Create `apps/web/src/components/layout/`:
   - `Sidebar.tsx` - Collapsible sidebar component
   - `BottomNav.tsx` - Mobile bottom navigation
   - `AppHeader.tsx` - Top header with business switcher, search, user

3. Update existing routes:
   - Remove duplicated header/nav from all page components
   - Pages render only their content

### Component Updates (without modifying shadcn)
1. Create wrapper components in `apps/web/src/components/composed/`:
   - `StatusBadge.tsx` - Unified status badge using Badge
   - `MetricCard.tsx` - Dashboard metric card
   - `ActivityItem.tsx` - Activity feed item

2. Update existing components:
   - `apps/web/src/components/app-nav.tsx` - Adapt for sidebar use
   - `apps/web/src/components/header.tsx` - Remove or repurpose

---

## Data Model

No database changes required. New queries needed:

### `api/dashboard.ts`
```typescript
// Get dashboard metrics for a business
export const getMetrics = query({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, args) => {
    // Return: activeConversations, escalatedCount, ordersToday, revenueToday, weeklyTrend
  },
});

// Get recent activity feed
export const getActivity = query({
  args: { businessId: v.id("businesses"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Return: array of { type, description, timestamp, link }
  },
});
```

---

## UI/UX Specifications

### Global Shell Wireframe
```
Desktop (≥1024px):
┌─────────────────────────────────────────────────────────────────┐
│ ┌────────┐                                                      │
│ │  Echo  │  [Business ▾]              [⌘K]        [🔔] [👤]    │
│ ├────────┼──────────────────────────────────────────────────────┤
│ │   🏠   │                                                      │
│ │   💬   │   Page Content                                       │
│ │   🛒   │                                                      │
│ │   📦   │                                                      │
│ │   ──   │                                                      │
│ │   ⚙️   │                                                      │
│ │        │                                                      │
│ │  [◀]   │                                                      │
│ └────────┴──────────────────────────────────────────────────────┘
Sidebar: 64px collapsed, 240px expanded

Mobile (<1024px):
┌─────────────────────────────────────┐
│ [≡]  Echo        [🔔] [👤]         │
├─────────────────────────────────────┤
│                                     │
│   Page Content                      │
│   (full width)                      │
│                                     │
├─────────────────────────────────────┤
│  🏠   💬   🛒   📦   ⚙️           │
└─────────────────────────────────────┘
```

### Dashboard Wireframe
```
┌─────────────────────────────────────────────────────────────────┐
│  Good morning, Carlos! 👋                                       │
│  Here's what's happening at La Parrilla                         │
├────────────────┬────────────────┬───────────────────────────────┤
│  💬 12 Active  │  🛒 8 New      │  📊 This Week                 │
│  ⚠️ 3 Escalated│  $1,240 today  │  [Sparkline] +12%            │
│  [View →]      │  [View →]      │  47 conversations             │
├────────────────┴────────────────┼───────────────────────────────┤
│  Recent Activity                │  Quick Actions                │
│  ────────────────────────────── │  ──────────────────────────── │
│  🔴 Maria escalated (2m)        │  [+ Add Product]              │
│  ✅ Order #1234 delivered       │  [⚙️ Settings]                │
│  💬 New from +57...             │  [📱 Connect WhatsApp]        │
│  [See all →]                    │                               │
└─────────────────────────────────┴───────────────────────────────┘
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| **Navigation duplications** | 0 (down from 15+) |
| **window.confirm() usage** | 0 (down from 4) |
| **Custom inline modals** | 0 (down from 2) |
| **Minimum text size** | 13px (labels), 15px (body) |
| **Consistent container widths** | 100% pages |
| **Dark mode support** | All pages |
| **Mobile bottom nav** | Implemented |
| **Dashboard metrics** | 3+ cards with real data |

---

## Implementation Order

### Phase 1: Foundation (Stories 1, 10, 11, 12)
1. Update CSS variables with Warm Signal palette
2. Add fonts
3. Create global navigation shell (`_authenticated.tsx`)
4. Fix all window.confirm → AlertDialog
5. Standardize status badges

### Phase 2: Core Pages (Stories 5, 6, 7, 8)
1. Dashboard with metrics
2. Conversations polish
3. Orders enhancement
4. Products refinement

### Phase 3: Auth & Onboarding (Stories 2, 3, 4)
1. Landing page redesign
2. Login/Signup pages
3. Multi-step onboarding

### Phase 4: Settings & Polish (Stories 9, 13, 14)
1. Settings reorganization
2. Dark mode verification
3. Mobile navigation
4. Final audit and testing

---

## Appendix: Reference Websites

For visual inspiration following the "Warm Signal" direction:

| Website | What to Study |
|---------|---------------|
| [Linear](https://linear.app) | Sidebar navigation, dark mode, polish |
| [Intercom](https://intercom.com) | Orange accent, chat interface |
| [Notion](https://notion.so) | Friendly professionalism, empty states |
| [Cal.com](https://cal.com) | Open source, warm colors |
| [Userlist](https://userlist.com) | Indie SaaS personality |
