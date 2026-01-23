# 12 - Marketing Website Content & Design - Product Requirements Document

## Overview

Build the content and visual design for Echo's marketing website at `apps/marketing`. The site targets creators, influencers, and online sellers with a modern, friendly, indie aesthetic using Echo's warm orange brand palette.

## Problem Statement

Echo needs a public-facing marketing website to:
1. Communicate the product value proposition to potential customers
2. Convert visitors into signups with clear pricing and CTAs
3. Showcase features that differentiate Echo from competitors (ManyChat, Gorgias)
4. Build trust through testimonials and social proof

The Astro scaffold exists (`apps/marketing`). This PRD covers the actual content, pages, and visual design implementation.

## Goals

- Create a compelling homepage that converts visitors to signups
- Clearly communicate Echo's value: "AI that sells while you sleep"
- Display transparent pricing (Free / Growth $49 / Scale $99)
- Showcase key features with dedicated pages
- Establish Echo's indie, creator-friendly brand personality
- Achieve Lighthouse score > 90 on all pages

## Non-Goals (Out of Scope)

- Blog or content marketing pages
- User authentication or dashboard access
- Dynamic functionality (forms submit to external services)
- Localization (English only for v1)
- A/B testing infrastructure
- Analytics implementation (separate task)

## Target Audience

| Segment | Description | Pain Point |
|---------|-------------|------------|
| **Instagram Creators** | 10K-500K followers selling products via DM | Can't respond to every DM, missing sales |
| **E-commerce Sellers** | Shopify store owners | Customer support overwhelms them |
| **Coaches/Service Providers** | Selling courses, consulting, services | Repetitive inquiry responses |
| **Small Online Businesses** | 1-10 person teams | No budget for support staff |

## Brand & Design Direction

### Visual Identity

| Element | Value |
|---------|-------|
| **Primary Color** | `#EA580C` (warm orange) |
| **Background** | `#FAFAF9` (warm stone white) |
| **Foreground** | `#1C1917` (warm black) |
| **Muted Text** | `#78716C` (warm gray) |
| **Border** | `#E7E5E4` |
| **Heading Font** | Plus Jakarta Sans (bold/semibold) |
| **Body Font** | DM Sans (regular) |
| **Border Radius** | 10px default |

### Design Principles

1. **Indie, not corporate** — Feels like a product made by humans, not a VC machine
2. **Warm and approachable** — Friendly copy, generous whitespace, soft corners
3. **Show, don't tell** — Real screenshots > abstract illustrations
4. **Strategic orange** — Use primary color sparingly for CTAs and accents
5. **Personality in details** — Clever micro-copy, subtle animations, human touches

### Inspiration Sources

- **ManyChat**: Playful copy, chat mockups, creator-focused messaging
- **Gorgias**: Clean structure, tabbed features, social proof with ratings

---

## Site Structure

```
/                           # Homepage
/features/ai-chat           # AI conversation engine
/features/integrations      # Channels (WhatsApp, Instagram coming soon)
/features/shopify           # Shopify sync
/features/customer-memory   # AI learns customers
/pricing                    # Dedicated pricing page
/about                      # Company story (optional v1)
/legal/privacy              # Privacy policy
/legal/terms                # Terms of service
```

---

## User Stories

### Story 1: Homepage Hero Section

**As a** visitor landing on the homepage  
**I want** to immediately understand what Echo does  
**So that** I can decide if it's relevant to me within 5 seconds

**Acceptance Criteria:**
- [ ] Eyebrow text: "AI for creators who sell"
- [ ] Main headline: "Your AI that sells while you sleep" (or approved variant)
- [ ] Subheadline explaining the value (1-2 sentences)
- [ ] Primary CTA: "Start Free" (orange button, links to app signup)
- [ ] Secondary CTA: "Watch Demo" or "See it in action" (ghost button/link)
- [ ] Trust text below CTA: "No credit card required"
- [ ] Hero image: Real app screenshot showing a WhatsApp conversation
- [ ] Screenshot has subtle floating animation (2-3px bob)
- [ ] Mobile responsive: stacks vertically on small screens

**Copy Options:**
```
Headline options:
- "Your AI that sells while you sleep"
- "Turn DMs into dollars. Automatically."
- "Stop missing sales in your inbox"

Subheadline:
"Echo answers customer questions, takes orders, and sounds just like you. 
Connect WhatsApp, add your products, and let AI handle the rest."
```

---

### Story 2: Social Proof Bar

**As a** visitor  
**I want** to see that others trust this product  
**So that** I feel confident it's legitimate

**Acceptance Criteria:**
- [ ] Positioned below hero section
- [ ] Displays key metrics OR customer logos
- [ ] If metrics: 3 stats with icons (e.g., "12,000+ messages", "98% response rate", "2 min setup")
- [ ] If logos: Scrolling marquee of customer logos
- [ ] Subtle styling, doesn't compete with hero
- [ ] Muted colors, not distracting

**Content (metrics option for launch):**
```
📬 10,000+ messages handled
💬 98% customer satisfaction  
⚡ 2 min average setup time
```

---

### Story 3: Features Overview Section

**As a** visitor  
**I want** to see the key features at a glance  
**So that** I understand what Echo offers

**Acceptance Criteria:**
- [ ] Section heading: "Everything you need to sell on autopilot"
- [ ] 4 feature cards in a 2x2 grid (desktop) or stacked (mobile)
- [ ] Each card has: icon (orange), title, description (2-3 lines), "Learn more →" link
- [ ] Cards have subtle hover effect (lift + shadow)
- [ ] Links go to respective feature pages

**Feature Cards Content:**

| Feature | Title | Description | Link |
|---------|-------|-------------|------|
| AI Chat | **AI That Sounds Like You** | Not robotic. Natural conversations that match your vibe and close sales 24/7. | /features/ai-chat |
| Integrations | **Connect Your Channels** | WhatsApp today. Instagram DMs and Messenger coming soon. One inbox for everything. | /features/integrations |
| Shopify | **Shopify Sync** | Products, inventory, and orders stay in sync. Import your catalog in one click. | /features/shopify |
| Memory | **Remembers Your Customers** | AI learns preferences, saves addresses, recalls past orders. Personal service at scale. | /features/customer-memory |

---

### Story 4: How It Works Section

**As a** visitor  
**I want** to understand how to get started  
**So that** I can see it's simple and not overwhelming

**Acceptance Criteria:**
- [ ] Section heading: "Get started in 3 steps"
- [ ] 3 steps displayed horizontally (desktop) or vertically (mobile)
- [ ] Each step has: number in orange circle, title, description
- [ ] Visual connection between steps (line or arrow)
- [ ] Clean, minimal design

**Content:**
```
Step 1: Connect
Link your WhatsApp Business number

Step 2: Add Products  
Import from Shopify or add manually

Step 3: Let Echo Sell
AI handles conversations, you handle fulfillment
```

---

### Story 5: Pricing Section (Homepage)

**As a** visitor  
**I want** to see pricing clearly on the homepage  
**So that** I can evaluate if Echo fits my budget

**Acceptance Criteria:**
- [ ] Section heading: "Simple pricing. Start free."
- [ ] 3 pricing tiers displayed side-by-side (desktop) or stacked (mobile)
- [ ] Growth plan visually highlighted as "Most Popular" with orange badge/border
- [ ] Each plan shows: name, price, feature list with checkmarks, CTA button
- [ ] Free and Growth have "Start Free" CTA
- [ ] Scale has "Contact Us" CTA
- [ ] Prices in USD, monthly billing displayed

**Pricing Tiers:**

| Plan | Price | Features | CTA |
|------|-------|----------|-----|
| **Free** | $0 | 500 contacts, Basic AI (limited responses/mo), WhatsApp integration | Start Free |
| **Growth** | $49/mo | Unlimited contacts, Full AI power, All integrations, Customer memory, Email support | Start Free (14-day trial) |
| **Scale** | $99/mo | Everything in Growth + Multi-brand support, Team seats (up to 5), Priority support | Contact Us |

---

### Story 6: Testimonials Section

**As a** visitor  
**I want** to see what real customers say  
**So that** I trust Echo delivers on its promises

**Acceptance Criteria:**
- [ ] Section heading: "What creators are saying"
- [ ] Display 2-3 testimonial cards
- [ ] Each card has: quote, customer photo, name, handle/business, follower count or business type
- [ ] Carousel navigation if more than 3 (dots or arrows)
- [ ] Quotes feel authentic, not overly polished
- [ ] Cards have subtle shadow and rounded corners

**Placeholder Testimonials (replace with real ones):**
```
"Echo handles 80% of my DMs. I finally have time to create content instead of answering the same questions over and over."
— Sarah Chen, @sarahcreates, 45K followers

"I was skeptical about AI sounding robotic, but Echo actually sounds like me. My customers can't tell the difference."
— Marcus Rodriguez, Founder of Urban Threads

"Setup took literally 5 minutes. Now I wake up to orders instead of unanswered messages."
— Priya Sharma, @priyamakes, Etsy Seller
```

---

### Story 7: Final CTA Section

**As a** visitor who scrolled through the homepage  
**I want** a clear final call to action  
**So that** I can sign up if I'm convinced

**Acceptance Criteria:**
- [ ] Full-width section with subtle background color (warm gray)
- [ ] Headline: "Ready to stop missing sales?"
- [ ] Primary CTA button: "Start Free — No credit card required"
- [ ] Secondary text link: "Questions? Chat with us →"
- [ ] CTA links to app signup
- [ ] Centered layout

---

### Story 8: Navigation Header

**As a** visitor  
**I want** a clear navigation  
**So that** I can find what I'm looking for

**Acceptance Criteria:**
- [ ] Fixed/sticky header on scroll
- [ ] Echo logo (left side, links to home)
- [ ] Nav links: Features (dropdown), Pricing, About (optional)
- [ ] Right side: "Log in" (text link), "Start Free" (orange button)
- [ ] Mobile: hamburger menu
- [ ] Header has subtle shadow/border when scrolled
- [ ] Features dropdown shows: AI Chat, Integrations, Shopify, Customer Memory

---

### Story 9: Footer

**As a** visitor  
**I want** to find secondary links and legal pages  
**So that** I can access additional information

**Acceptance Criteria:**
- [ ] Echo logo and tagline
- [ ] Link columns: Product, Resources, Company, Legal
- [ ] Social links (if applicable)
- [ ] Copyright notice
- [ ] Minimal, clean design
- [ ] Links to privacy policy and terms of service

**Footer Links:**
```
Product: Features, Pricing, Integrations
Resources: Documentation, Help Center (link to Fumadocs)
Company: About, Contact
Legal: Privacy Policy, Terms of Service
```

---

### Story 10: Feature Page - AI Chat

**As a** visitor interested in AI capabilities  
**I want** to learn how Echo's AI works  
**So that** I understand its capabilities

**Acceptance Criteria:**
- [ ] Page at `/features/ai-chat`
- [ ] Hero with feature-specific headline and screenshot
- [ ] Sections covering: Natural conversation, Multi-language, Intent recognition, Human escalation
- [ ] Real chat examples showing AI in action
- [ ] CTA to start free trial
- [ ] Breadcrumb navigation

**Content Sections:**
```
Hero: "AI that actually sounds human"
Subheadline: "Echo learns your tone, understands context, and handles conversations like you would—but 24/7."

Section 1: Natural Conversations
- No robotic scripts
- Matches your communication style
- Handles typos, slang, abbreviations

Section 2: Multi-Language Support
- Auto-detects customer language
- Responds in English, Spanish, Portuguese
- Seamless switching mid-conversation

Section 3: Smart Intent Recognition
- Understands what customers want
- Handles product questions, orders, complaints
- Knows when to escalate to humans

Section 4: Human Handoff
- AI knows its limits
- Seamless escalation when needed
- You stay in control
```

---

### Story 11: Feature Page - Integrations

**As a** visitor  
**I want** to see what channels Echo supports  
**So that** I know if it works with my setup

**Acceptance Criteria:**
- [ ] Page at `/features/integrations`
- [ ] Hero with integrations headline
- [ ] Channel cards: WhatsApp (available), Instagram (coming soon), Messenger (coming soon)
- [ ] "Coming soon" badges on unreleased channels
- [ ] Email capture for "notify me when available" (optional)
- [ ] CTA to get started with WhatsApp

**Content:**
```
Hero: "One inbox for all your conversations"
Subheadline: "Connect the channels where your customers message you. Start with WhatsApp, expand as we grow."

WhatsApp Business (Available)
- Full integration via Twilio
- Send and receive messages
- Rich media support
- Message templates

Instagram DMs (Coming Q2 2026)
- Auto-reply to DMs
- Comment-to-DM automation
- Story mentions

Facebook Messenger (Coming Q2 2026)
- Page messaging
- Automated responses
```

---

### Story 12: Feature Page - Shopify

**As a** Shopify store owner  
**I want** to see how Echo integrates with my store  
**So that** I understand the value for my setup

**Acceptance Criteria:**
- [ ] Page at `/features/shopify`
- [ ] Hero emphasizing Shopify integration
- [ ] Sections: Product sync, Order creation, Inventory sync
- [ ] Shopify logo displayed prominently
- [ ] Screenshot of product catalog
- [ ] CTA: "Connect your Shopify store"

**Content:**
```
Hero: "Built for Shopify sellers"
Subheadline: "Import your products, sync your orders, keep inventory up to date. One click to connect."

Section 1: One-Click Product Import
- Import entire catalog instantly
- Products with variants supported
- Prices and descriptions synced

Section 2: Orders Created in Shopify
- AI creates draft orders
- Checkout links sent to customers
- Orders appear in your Shopify dashboard

Section 3: Real-Time Inventory
- Stock levels always accurate
- Sold out = AI knows immediately
- No overselling
```

---

### Story 13: Feature Page - Customer Memory

**As a** visitor  
**I want** to understand Echo's memory features  
**So that** I see how it provides personalized service

**Acceptance Criteria:**
- [ ] Page at `/features/customer-memory`
- [ ] Hero emphasizing personalization
- [ ] Sections: Customer profiles, Preferences & allergies, Saved addresses, Order history
- [ ] Privacy reassurance (data protection)
- [ ] CTA to start free trial

**Content:**
```
Hero: "AI that remembers your customers"
Subheadline: "Every customer gets VIP treatment. Echo remembers preferences, addresses, and past orders—so you don't have to."

Section 1: Customer Profiles
- Automatic profile creation
- Order history at a glance
- Lifetime value tracking

Section 2: Preferences & Restrictions
- Allergies (safety critical)
- Dietary preferences
- Communication preferences
- AI warns about conflicts

Section 3: Saved Addresses
- Delivery addresses remembered
- One-tap reorder
- Default address support

Section 4: Privacy First
- GDPR/LGPD compliant
- Customer data deletion on request
- Secure, encrypted storage
```

---

### Story 14: Dedicated Pricing Page

**As a** visitor comparing options  
**I want** a detailed pricing page  
**So that** I can make an informed decision

**Acceptance Criteria:**
- [ ] Page at `/pricing`
- [ ] Same pricing table as homepage
- [ ] Additional feature comparison table below
- [ ] FAQ section with common pricing questions
- [ ] CTA buttons for each plan

**FAQ Content:**
```
Q: Can I change plans later?
A: Yes, upgrade or downgrade anytime from your dashboard.

Q: What happens when I hit the free plan limits?
A: Echo will notify you. Your AI keeps working, but responses may be delayed until you upgrade.

Q: Is there a contract?
A: No contracts. Pay monthly, cancel anytime.

Q: Do you offer annual billing?
A: Not yet, but it's coming soon with a discount.

Q: What payment methods do you accept?
A: All major credit cards via Stripe.
```

---

### Story 15: Legal Pages

**As a** visitor  
**I want** to read privacy policy and terms  
**So that** I understand how my data is handled

**Acceptance Criteria:**
- [ ] Privacy Policy at `/legal/privacy`
- [ ] Terms of Service at `/legal/terms`
- [ ] Clean, readable formatting
- [ ] Last updated date displayed
- [ ] Standard legal content (can be placeholder for v1, legal review later)

---

## Technical Requirements

### Framework & Stack
- Astro 6 (already scaffolded)
- MDX for content pages
- Tailwind CSS v4 with Echo design tokens
- shadcn/ui components (React islands)
- Cloudflare deployment via Alchemy

### Performance Targets
| Metric | Target |
|--------|--------|
| Lighthouse Performance | > 95 |
| Lighthouse Accessibility | > 95 |
| First Contentful Paint | < 1s |
| Largest Contentful Paint | < 2s |
| Total Blocking Time | < 100ms |

### SEO Requirements
- [ ] Unique title and meta description per page
- [ ] Open Graph tags for social sharing
- [ ] Canonical URLs
- [ ] Sitemap.xml generated
- [ ] robots.txt configured

### Responsive Breakpoints
| Breakpoint | Width |
|------------|-------|
| Mobile | < 640px |
| Tablet | 640px - 1024px |
| Desktop | > 1024px |

---

## UI Components Needed

### New Components to Build

| Component | Type | Description |
|-----------|------|-------------|
| `Hero.astro` | Astro | Homepage hero with headline, CTAs, screenshot |
| `FeatureCard.astro` | Astro | Card with icon, title, description, link |
| `PricingTable.astro` | Astro | 3-column pricing comparison |
| `PricingCard.astro` | Astro | Individual plan card |
| `Testimonial.astro` | Astro | Quote card with avatar |
| `TestimonialCarousel.tsx` | React | Carousel wrapper (needs client:load) |
| `StepIndicator.astro` | Astro | Numbered step with connecting line |
| `SocialProofBar.astro` | Astro | Stats or logo marquee |
| `Header.astro` | Astro | Navigation header with dropdown |
| `MobileMenu.tsx` | React | Mobile hamburger menu (needs client:load) |
| `Footer.astro` | Astro | Site footer |
| `FeatureSection.astro` | Astro | Reusable feature page section |
| `CTASection.astro` | Astro | Full-width CTA block |
| `FAQ.tsx` | React | Accordion FAQ (needs client:load) |
| `Badge.astro` | Astro | "Coming Soon", "Popular" badges |

### Existing shadcn/ui to Use
- Button (CTA styling)
- Accordion (FAQ)
- Tabs (feature comparisons if needed)

---

## Content Collections (MDX)

### Collection: `pages`
For main pages (homepage, about)

### Collection: `features`  
For feature page content
```
/src/content/features/ai-chat.mdx
/src/content/features/integrations.mdx
/src/content/features/shopify.mdx
/src/content/features/customer-memory.mdx
```

### Collection: `testimonials`
For customer quotes
```
/src/content/testimonials/sarah-chen.mdx
/src/content/testimonials/marcus-rodriguez.mdx
/src/content/testimonials/priya-sharma.mdx
```

### Collection: `faq`
For FAQ items
```
/src/content/faq/change-plans.mdx
/src/content/faq/free-plan-limits.mdx
...
```

### Collection: `legal`
For legal pages
```
/src/content/legal/privacy.mdx
/src/content/legal/terms.mdx
```

---

## Assets Needed

| Asset | Type | Description |
|-------|------|-------------|
| Echo logo | SVG | Logo for header/footer |
| App screenshot | PNG | WhatsApp conversation showing Echo AI |
| Feature icons | SVG/Lucide | Icons for feature cards |
| Customer avatars | JPG | Testimonial photos (placeholder ok for v1) |
| OG image | PNG | Social sharing image (1200x630) |
| Favicon | ICO/PNG | Browser favicon |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Conversion rate (visitor → signup) | > 3% | Analytics |
| Bounce rate | < 50% | Analytics |
| Time on page (homepage) | > 45s | Analytics |
| Lighthouse scores | > 90 all categories | Lighthouse CI |
| Mobile usability | 100% | Google Search Console |

---

## Implementation Order

1. **Phase 1: Core Layout**
   - Header component
   - Footer component
   - Base layout integration
   - Mobile responsive navigation

2. **Phase 2: Homepage**
   - Hero section
   - Social proof bar
   - Features overview
   - How it works
   - Pricing table
   - Testimonials
   - Final CTA

3. **Phase 3: Feature Pages**
   - AI Chat page
   - Integrations page
   - Shopify page
   - Customer Memory page

4. **Phase 4: Supporting Pages**
   - Dedicated pricing page with FAQ
   - Legal pages (privacy, terms)

5. **Phase 5: Polish**
   - Animations and micro-interactions
   - SEO optimization
   - Performance optimization
   - Cross-browser testing

---

## Open Questions

1. **Real testimonials**: Do we have actual customer quotes, or use placeholders for v1?
2. **App screenshots**: Do we have finalized UI to screenshot, or create mockups?
3. **Logo**: Is the Echo logo finalized?
4. **Demo video**: Should "Watch Demo" link to a video, or interactive demo?
5. **Contact Us (Scale plan)**: What's the contact method? Email, Calendly, or form?
6. **Analytics**: Which analytics provider? (Plausible, PostHog, Google Analytics)

---

## Dependencies

- Marketing site Astro scaffold (PRD #11) - **COMPLETED**
- Echo design system colors/tokens - **AVAILABLE** in `apps/web/src/index.css`
- App signup flow - **REQUIRED** for CTA links
- Legal content review - **REQUIRED** before launch

---

## Appendix: Copy Bank

### Headlines (tested variations for A/B)
```
Primary:
- "Your AI that sells while you sleep"

Alternatives:
- "Turn DMs into dollars. Automatically."
- "Stop missing sales in your inbox"
- "AI that sounds like you, sells for you"
- "Sell more. Reply less."
```

### CTAs
```
Primary: "Start Free"
Secondary: "Watch Demo" / "See it in action"
Pricing: "Start Free Trial" / "Contact Us"
Final: "Start Free — No credit card required"
```

### Taglines
```
- "AI for creators who sell"
- "Your always-on sales assistant"
- "Personal service at scale"
```
