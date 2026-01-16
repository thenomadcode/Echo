# 01 - Business Onboarding - Product Requirements Document

## Overview
Enable business owners to sign up, create their business profile, and configure basic settings to start using Echo.

## Problem Statement
Before a business can use Echo to handle customer conversations, they need to:
1. Create an account (authentication)
2. Register their business with basic information
3. Configure initial settings (business name, language, timezone)

This is the foundational feature that gates all other functionality.

## Goals
- Simple, fast onboarding (under 5 minutes)
- Collect only essential information upfront
- Create a multi-tenant foundation where each user owns one or more businesses
- Set up the business for subsequent features (products, WhatsApp, etc.)

## Non-Goals (Out of Scope)
- WhatsApp number verification (separate feature)
- Shopify integration setup (separate feature)
- Team members / multi-user per business (later)
- Billing / subscription management (later)

## User Stories

### Story 1: Sign Up
**As a** business owner  
**I want** to create an account with email/password or social login  
**So that** I can access Echo securely

**Acceptance Criteria:**
- [ ] User can sign up with email + password
- [ ] User can sign up with Google OAuth
- [ ] Email verification is sent (optional for MVP, can be toggled)
- [ ] User is redirected to business creation after signup
- [ ] Existing users are redirected to login

### Story 2: Create Business Profile
**As a** newly registered user  
**I want** to create my business profile  
**So that** Echo knows about my business

**Acceptance Criteria:**
- [ ] User sees business creation form after first login
- [ ] Required fields: business name, business type (dropdown: restaurant, pharmacy, retail, other)
- [ ] Optional fields: description, logo upload, address
- [ ] Business slug is auto-generated from name (editable)
- [ ] User becomes owner of the created business
- [ ] After creation, user lands on dashboard

### Story 3: Business Settings
**As a** business owner  
**I want** to configure my business settings  
**So that** Echo behaves appropriately for my context

**Acceptance Criteria:**
- [ ] Settings page accessible from dashboard
- [ ] Can edit: business name, description, logo
- [ ] Can set: default language (Spanish, Portuguese, English)
- [ ] Can set: timezone
- [ ] Can set: business hours (when AI should respond)
- [ ] Can set: AI greeting message template
- [ ] Changes save and reflect immediately

### Story 4: View My Businesses
**As a** user with multiple businesses  
**I want** to switch between my businesses  
**So that** I can manage them separately

**Acceptance Criteria:**
- [ ] User can see list of their businesses
- [ ] User can switch active business context
- [ ] Each business has isolated data (products, conversations, orders)
- [ ] UI clearly shows which business is currently active

## Technical Requirements

### Authentication
- Use existing Better-Auth setup
- Providers: email/password + Google OAuth
- Session management via Convex

### Stack
- Frontend: TanStack Start (existing)
- Backend: Convex (existing)
- Auth: Better-Auth with Convex adapter (existing)

### API Endpoints (Convex Functions)
```typescript
// Mutations
businesses.create({ name, type, description?, logo?, address? })
businesses.update({ businessId, ...fields })

// Queries
businesses.list() // all businesses for current user
businesses.get({ businessId }) // single business details
```

## Data Model

### `businesses` table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| name | string | yes | Business display name |
| slug | string | yes | URL-safe identifier (unique) |
| type | string | yes | "restaurant" \| "pharmacy" \| "retail" \| "other" |
| description | string | no | Business description |
| logoUrl | string | no | Logo image URL |
| address | string | no | Physical address |
| defaultLanguage | string | yes | "es" \| "pt" \| "en" (default: "es") |
| timezone | string | yes | IANA timezone (default: "America/Bogota") |
| businessHours | object | no | { open: "09:00", close: "18:00", days: [1,2,3,4,5] } |
| aiGreeting | string | no | Custom greeting template |
| ownerId | Id<"users"> | yes | Reference to owner user |
| createdAt | number | yes | Timestamp |
| updatedAt | number | yes | Timestamp |

### Indexes
- `by_owner`: [ownerId] - list businesses by user
- `by_slug`: [slug] - lookup by slug (unique)

## UI/UX

### Pages
1. `/signup` - Sign up form
2. `/login` - Login form  
3. `/onboarding` - Business creation (post-signup)
4. `/dashboard` - Main dashboard (redirects here after login)
5. `/settings` - Business settings

### User Flow
```
[Landing] → [Sign Up] → [Create Business] → [Dashboard]
                ↓
           [Login] → [Select Business] → [Dashboard]
```

### Design Notes
- Keep forms minimal - don't overwhelm new users
- Show progress indicator during onboarding
- Use friendly, conversational copy (not corporate)
- Mobile-responsive (business owners often on phone)

## Success Metrics
- Onboarding completion rate > 80%
- Time to complete onboarding < 5 minutes
- Business creation success rate > 95%

## Dependencies
- Better-Auth configured (existing)
- Convex database (existing)

## Open Questions
- Should we require email verification before allowing business creation?
- Do we need terms of service acceptance during signup?
