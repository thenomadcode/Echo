# User Documentation - Product Requirements Document

## Overview

Create comprehensive user documentation for Echo, a WhatsApp AI customer service platform, targeting business owners in Latin America (restaurants, pharmacies, retail stores). Documentation will be hosted on the existing Fumadocs site (`apps/fumadocs`).

## Problem Statement

Business users need clear, accessible documentation to:
- Set up their Echo account and connect WhatsApp
- Manage their product catalog effectively
- Understand how the AI handles customer conversations
- Process and fulfill orders
- Configure integrations (WhatsApp, Shopify)
- Customize AI behavior and business settings

Without documentation, users rely on trial-and-error or support requests, increasing churn and support burden.

## Goals

- Provide clear onboarding documentation so users can go live within 30 minutes
- Document all features visible in the Echo dashboard
- Enable self-service troubleshooting for common issues
- Structure content for future localization (Spanish, Portuguese)

## Non-Goals (Out of Scope)

- API/developer documentation
- Video tutorials (future enhancement)
- Localized versions (ES/PT) - will be Phase 2
- Documentation for admin/internal features
- Inline help/tooltips in the app (separate effort)

## User Stories

### Story 1: New User Finds Quick Start Guide

**As a** new Echo user  
**I want** a quick start checklist  
**So that** I can get my business live on WhatsApp as fast as possible

**Acceptance Criteria:**
- [ ] Landing page (`index.mdx`) explains what Echo does in 2-3 sentences
- [ ] Quick Start page lists 5-7 steps to go live
- [ ] Each step links to detailed documentation
- [ ] Estimated time to complete is shown (e.g., "~30 minutes")

### Story 2: User Sets Up Business Profile

**As a** new user completing onboarding  
**I want** documentation on the business setup wizard  
**So that** I understand each step and what information to provide

**Acceptance Criteria:**
- [ ] Business setup page explains the 3-step wizard
- [ ] Each step (Business Info, Branding, Confirmation) is documented
- [ ] Required vs optional fields are indicated
- [ ] Business types (restaurant, pharmacy, retail, other) are explained

### Story 3: User Manages Product Catalog

**As a** business owner  
**I want** documentation on product management  
**So that** I can add, edit, and organize my products

**Acceptance Criteria:**
- [ ] Products page covers viewing, searching, filtering products
- [ ] Adding a new product is documented with all fields explained
- [ ] Editing and deleting products is covered
- [ ] Bulk operations (select multiple, mark available/unavailable, delete) are documented
- [ ] Product availability toggle and its effects are explained
- [ ] Grid vs table view options are mentioned

### Story 4: User Organizes Products with Categories

**As a** business owner with many products  
**I want** documentation on categories  
**So that** I can organize my catalog and help customers find products

**Acceptance Criteria:**
- [ ] Categories page explains purpose of categories
- [ ] Creating, editing, deleting categories is documented
- [ ] Moving products between categories is explained
- [ ] "Uncategorized" products concept is covered

### Story 5: User Manages Orders

**As a** business owner  
**I want** documentation on order management  
**So that** I can process and fulfill customer orders

**Acceptance Criteria:**
- [ ] Orders page explains order lifecycle (draft → confirmed → paid → preparing → ready → delivered)
- [ ] Cancelled orders are documented
- [ ] Filtering and searching orders is covered
- [ ] Order detail view is documented (items, customer, delivery, payment, timeline)
- [ ] Fulfillment actions (Mark Preparing, Mark Ready, Mark Delivered) are explained
- [ ] Cancelling orders is documented

### Story 6: User Handles Conversations

**As a** business owner  
**I want** documentation on the conversation dashboard  
**So that** I can monitor AI interactions and intervene when needed

**Acceptance Criteria:**
- [ ] Conversations page explains the list + detail view layout
- [ ] Conversation statuses (active, escalated, closed) are documented
- [ ] Filtering and searching conversations is covered
- [ ] "Take Over" functionality is explained (when/why to use)
- [ ] Sending messages as a human is documented
- [ ] "Hand Back" to AI is explained
- [ ] Closing and reopening conversations is covered
- [ ] Escalation reasons are explained

### Story 7: User Views Customer Information

**As a** business owner  
**I want** documentation on customer management  
**So that** I can view customer history and manage contacts

**Acceptance Criteria:**
- [ ] Customers page explains how customers are auto-created from WhatsApp
- [ ] Customer list with sorting options is documented
- [ ] Customer detail view (name, phone, orders, spend) is covered
- [ ] Manually adding a customer is documented
- [ ] Phone number format (E.164 with country code) is explained

### Story 8: User Connects WhatsApp

**As a** business owner  
**I want** step-by-step WhatsApp setup documentation  
**So that** I can connect my WhatsApp Business number to Echo

**Acceptance Criteria:**
- [ ] WhatsApp page explains Twilio as the provider
- [ ] Links to create Twilio account and WhatsApp Sandbox
- [ ] Account SID, Auth Token, Phone Number fields are explained
- [ ] Webhook URL configuration is documented with copy button mention
- [ ] Testing connection is covered
- [ ] Connection status indicators are explained
- [ ] Troubleshooting common issues is included

### Story 9: User Connects Shopify

**As a** business owner with a Shopify store  
**I want** Shopify integration documentation  
**So that** I can sync my product catalog from Shopify

**Acceptance Criteria:**
- [ ] Shopify page explains the integration benefits
- [ ] Connecting with store URL is documented (OAuth flow)
- [ ] Initial product import is explained
- [ ] Sync options (auto-sync, create orders, sync status) are documented
- [ ] Manual sync is covered
- [ ] Disconnecting Shopify is documented
- [ ] What happens to products after disconnect is explained

### Story 10: User Configures Business Settings

**As a** business owner  
**I want** documentation on all business settings  
**So that** I can customize Echo for my business

**Acceptance Criteria:**
- [ ] Business Settings page covers Business Info (name, description, logo)
- [ ] Localization settings (language, timezone) are documented
- [ ] Business Hours configuration is explained
- [ ] Data Retention / Privacy settings are documented
- [ ] Navigation between settings sections is explained

### Story 11: User Customizes AI Behavior

**As a** business owner  
**I want** documentation on AI configuration  
**So that** I can personalize how the AI interacts with my customers

**Acceptance Criteria:**
- [ ] AI Configuration page explains how the AI works at a high level
- [ ] Greeting message customization is documented
- [ ] Personality instructions are explained with examples
- [ ] Escalation keywords are documented with examples
- [ ] Language auto-detection is mentioned
- [ ] Tips for effective AI customization are included

### Story 12: User Finds Answers to Common Questions

**As a** user with questions  
**I want** an FAQ page  
**So that** I can quickly find answers without reading full docs

**Acceptance Criteria:**
- [ ] FAQ page covers 10-15 common questions
- [ ] Questions are grouped by topic
- [ ] Answers are concise with links to detailed docs
- [ ] Troubleshooting questions are included

### Story 13: User Navigates Documentation Easily

**As a** documentation reader  
**I want** good navigation and search  
**So that** I can find information quickly

**Acceptance Criteria:**
- [ ] Sidebar navigation reflects the page hierarchy
- [ ] Search functionality works across all pages
- [ ] Pages have clear headings and table of contents
- [ ] Related pages are linked at the bottom
- [ ] Breadcrumbs show current location

### Story 14: User Accesses Docs from App

**As a** Echo user  
**I want** a link to documentation in the app header  
**So that** I can quickly access help while using the platform

**Acceptance Criteria:**
- [ ] Documentation link added to main app navigation/header
- [ ] Link opens docs in new tab
- [ ] Link is visible on all authenticated pages

## Technical Requirements

### Platform
- **Framework**: Fumadocs (already configured in `apps/fumadocs`)
- **Content**: MDX files in `apps/fumadocs/content/docs/`
- **Styling**: Existing Fumadocs theme (no customization needed)

### File Structure
```
apps/fumadocs/content/docs/
├── index.mdx                          # Welcome to Echo
├── getting-started/
│   ├── meta.json                      # Navigation config
│   ├── index.mdx                      # Quick Start Guide
│   └── business-setup.mdx             # Setting Up Your Business
├── products/
│   ├── meta.json
│   ├── index.mdx                      # Managing Products
│   └── categories.mdx                 # Categories & Organization
├── orders.mdx                         # Managing Orders
├── conversations.mdx                  # Conversations & Customer Support
├── customers.mdx                      # Customer Management
├── integrations/
│   ├── meta.json
│   ├── index.mdx                      # Integrations Overview
│   ├── whatsapp.mdx                   # Connecting WhatsApp
│   └── shopify.mdx                    # Shopify Integration
├── settings/
│   ├── meta.json
│   ├── index.mdx                      # Business Settings
│   └── ai-configuration.mdx           # AI & Automation
└── faq.mdx                            # Frequently Asked Questions
```

### MDX Components to Use
- `<Callout>` - Tips, warnings, important notes
- `<Cards>` / `<Card>` - Link grids for related pages
- `<Steps>` - Numbered step-by-step instructions
- `<Tabs>` - For showing alternatives (if needed)
- Standard markdown: headings, lists, tables, code blocks

### Navigation Configuration
Each folder needs a `meta.json` to configure sidebar order:
```json
{
  "title": "Section Title",
  "pages": ["index", "other-page"]
}
```

Root `meta.json` in `content/docs/`:
```json
{
  "title": "Echo Documentation",
  "pages": [
    "index",
    "---Getting Started---",
    "getting-started",
    "---Features---", 
    "products",
    "orders",
    "conversations",
    "customers",
    "---Setup---",
    "integrations",
    "settings",
    "---Help---",
    "faq"
  ]
}
```

## UI/UX Considerations

### Writing Style
- **Tone**: Friendly, professional, concise
- **Audience**: Non-technical business owners
- **Language**: English (primary), future ES/PT
- **Avoid**: Technical jargon, developer terminology

### Page Structure
Each page should follow:
1. **Title** - Clear, descriptive (H1)
2. **Introduction** - 1-2 sentences explaining the page
3. **Content** - Organized with H2/H3 headings
4. **Next Steps** - Links to related pages (where applicable)

### Callout Usage
- `<Callout type="info">` - Tips and helpful information
- `<Callout type="warning">` - Important warnings
- `<Callout type="error">` - Critical information / don't do this

### Screenshots

**Philosophy**: Screenshots only when they guide users through complex workflows. No screenshots just for decoration.

- Saved to `apps/fumadocs/public/images/docs/`
- Naming convention: `[section]-[feature].png`
- Resize to consistent width (1200px)
- Light mode only

**Screenshots to capture:**
| Screenshot | Purpose |
|------------|---------|
| `dashboard.png` | Main docs landing page - orient users to the platform |
| `whatsapp-webhook.png` | Show where to copy webhook URL and where it goes in Twilio |
| `shopify-connect.png` | OAuth flow can be confusing - show the store URL input |
| `conversation-takeover.png` | Clarify Take Over / Hand Back buttons and when to use them |
| `bulk-operations.png` | Show the selection toolbar - users may not discover this |

**No screenshots needed for:**
- Simple lists (products, orders, customers)
- Basic forms (add/edit product, settings)
- Single-action buttons (Mark Preparing, Close conversation)
- Anything self-explanatory from text description

## Success Metrics

| Metric | Target |
|--------|--------|
| All 14 pages created | 100% |
| Each user story acceptance criteria met | 100% |
| Documentation builds without errors | Yes |
| Search indexes all pages | Yes |
| Navigation reflects hierarchy | Yes |

## Implementation Notes

### Existing Fumadocs Setup
The fumadocs app is already configured:
- `source.config.ts` - Content source configuration
- `src/lib/source.ts` - Source loader
- Existing test pages can be removed/replaced

### Content Guidelines
1. Start each page with frontmatter:
   ```yaml
   ---
   title: Page Title
   description: Brief description for SEO/search
   ---
   ```

2. Use relative links between docs:
   ```markdown
   See [Managing Products](/docs/products) for more details.
   ```

3. Group related content with headings, not separate pages

### Dependencies
No new dependencies required. Fumadocs is already installed with:
- `fumadocs-core`
- `fumadocs-ui`
- `fumadocs-mdx`

### Screenshot Prerequisites
Before capturing the 5 screenshots:
- Dev server running (`bun run dev`)
- Logged-in user session
- For dashboard: some products, orders, conversations (realistic metrics)
- For WhatsApp/Shopify: navigate to settings pages (no connection required)
- For conversation takeover: at least 1 active conversation
- For bulk operations: 3+ products to demonstrate selection

## Decisions

| Question | Decision |
|----------|----------|
| Screenshots | Yes - capture via Chrome DevTools during implementation |
| Troubleshooting page | Not yet - FAQ is sufficient for Phase 1 |
| Link from app header | Yes - add documentation link to main Echo app navigation |
