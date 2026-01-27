# AI Typing Indicator - Product Requirements Document

## Overview

Show a visual "typing" indicator when the AI is processing a response, both in the Echo dashboard and in customer-facing messaging channels (WhatsApp, Instagram, Facebook Messenger). This reduces user uncertainty during the AI processing delay.

## Problem Statement

When a customer sends a message, there's a 2-10 second delay while the AI processes and generates a response. During this time:
- **Customers** see no feedback on WhatsApp/Instagram - they don't know if their message was received or if anyone is responding
- **Business owners** viewing the dashboard don't know if the AI is working on a response or if something is stuck

This uncertainty leads to:
- Customers sending duplicate messages
- Perceived slowness/unreliability
- Business owners manually intervening unnecessarily

## Goals

- Show real-time "typing" indicator in Echo dashboard when AI is processing
- Send typing status to WhatsApp/Meta APIs so customers see "typing..." in their chat
- Provide clear feedback when AI processing takes too long (timeout after 30s)
- Improve perceived responsiveness of the AI assistant

## Non-Goals (Out of Scope)

- Typing indicator for human agent responses (future enhancement)
- Estimated time remaining for AI response
- Progressive/streaming AI responses (showing text as it generates)

## User Stories

### Story 1: Dashboard Typing Indicator

**As a** business owner viewing a conversation in the Echo dashboard
**I want** to see a typing indicator when the AI is processing a response
**So that** I know the AI is working and don't need to intervene

**Acceptance Criteria:**
- [ ] When a customer message is received and AI processing starts, a typing indicator appears below the last message
- [ ] The indicator shows animated dots + "Echo AI is typing..." label
- [ ] The indicator appears on the AI side (right-aligned, like AI messages)
- [ ] The indicator disappears when the AI response is saved
- [ ] The indicator uses the same styling as message bubbles (muted background)

### Story 2: WhatsApp Typing Status

**As a** customer chatting via WhatsApp
**I want** to see "typing..." status when the AI is preparing a response
**So that** I know my message was received and a response is coming

**Acceptance Criteria:**
- [ ] When AI processing starts, send `typing` status to WhatsApp API
- [ ] WhatsApp shows "typing..." indicator to the customer
- [ ] Typing status is sent within 1 second of receiving customer message
- [ ] Works for all WhatsApp-connected businesses

### Story 3: Meta (Instagram/Messenger) Typing Status

**As a** customer chatting via Instagram DM or Facebook Messenger
**I want** to see typing indicator when the AI is preparing a response
**So that** I know a response is coming

**Acceptance Criteria:**
- [ ] When AI processing starts, send typing indicator via Meta Send API
- [ ] Instagram/Messenger shows typing bubble to the customer
- [ ] Typing status is sent within 1 second of receiving customer message
- [ ] Works for all Meta-connected businesses

### Story 4: Timeout Handling

**As a** business owner
**I want** to see an error state if the AI takes too long to respond
**So that** I know to manually intervene

**Acceptance Criteria:**
- [ ] If AI doesn't respond within 30 seconds, the typing indicator changes to an error state
- [ ] Error state shows "AI response timed out" with option to retry or respond manually
- [ ] Timeout is logged for monitoring/debugging
- [ ] The `isAiProcessing` flag is automatically cleared on timeout

### Story 5: Processing State Tracking

**As a** developer
**I want** accurate tracking of AI processing state
**So that** the typing indicator reflects reality

**Acceptance Criteria:**
- [ ] `isAiProcessing` boolean field added to conversation schema
- [ ] `processingStartedAt` timestamp field added for timeout calculation
- [ ] Field is set to `true` when customer message is received (in webhook handler)
- [ ] Field is set to `false` when AI response is saved
- [ ] Field is set to `false` if processing fails/errors
- [ ] State is reactive (Convex subscription updates UI in real-time)

## Technical Requirements

### Backend (Convex)

**Schema Changes:**
```typescript
// In conversations table
isAiProcessing: v.optional(v.boolean()),
processingStartedAt: v.optional(v.number()), // timestamp
```

**Processing Flow:**
1. Webhook receives customer message
2. Set `isAiProcessing: true`, `processingStartedAt: Date.now()`
3. Send typing status to WhatsApp/Meta API (fire and forget)
4. Process AI response
5. Save AI response message
6. Set `isAiProcessing: false`, clear `processingStartedAt`

**WhatsApp Typing API:**
```
POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "{customer_phone}",
  "type": "reaction",
  "status": "typing"
}
```

Note: WhatsApp Business API doesn't have a native typing indicator. Alternative approach:
- Use "read receipts" (mark as read immediately) to show message was seen
- The actual "typing..." is only visible on Meta platforms

**Meta Typing API:**
```
POST https://graph.facebook.com/v21.0/me/messages
{
  "recipient": { "id": "{user_id}" },
  "sender_action": "typing_on"
}
```

### Frontend (React)

**New Component:** `TypingIndicator.tsx`
- Animated three-dot indicator
- "Echo AI is typing..." label
- Timeout state with error message
- Retry button

**Conversation View Changes:**
- Subscribe to `isAiProcessing` and `processingStartedAt`
- Show `TypingIndicator` when `isAiProcessing === true`
- Calculate timeout client-side using `processingStartedAt`

## Data Model

### Conversation Table Updates

| Field | Type | Description |
|-------|------|-------------|
| `isAiProcessing` | `boolean?` | True when AI is generating response |
| `processingStartedAt` | `number?` | Timestamp when processing started (for timeout) |

## UI/UX

### Typing Indicator Component

```
┌─────────────────────────────────────┐
│                                     │
│  Customer: "What's your price?"     │
│                                     │
│         ┌───────────────────────┐   │
│         │ ●●● Echo AI is typing │   │
│         └───────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**Animation:** Three dots with staggered bounce animation (0.3s delay between each)

**Colors:**
- Background: `bg-muted` (same as AI message bubbles)
- Dots: `text-muted-foreground`
- Label: `text-muted-foreground text-xs`

### Timeout State

```
┌─────────────────────────────────────┐
│                                     │
│  Customer: "What's your price?"     │
│                                     │
│    ┌─────────────────────────────┐  │
│    │ ⚠ AI response timed out    │  │
│    │ [Retry] [Respond manually] │  │
│    └─────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

## API Considerations

### WhatsApp Limitations
- WhatsApp Business API doesn't support typing indicators natively
- Best we can do: Mark message as "read" immediately (blue checkmarks)
- Consider noting this limitation in the UI

### Meta (Instagram/Messenger)
- Full support for `sender_action: "typing_on"`
- Typing indicator auto-expires after 20 seconds
- May need to re-send typing status for long AI processing

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Duplicate messages | -50% | Count messages sent within 5s of previous |
| Manual interventions | -30% | Count human takeovers during AI processing |
| Processing visibility | 100% | Typing indicator shown for all AI responses |
| Timeout rate | <5% | Responses taking >30s / total responses |

## Implementation Order

1. **Phase 1: Backend** - Add schema fields, update webhook handlers
2. **Phase 2: Dashboard UI** - Create TypingIndicator component, integrate into conversation view
3. **Phase 3: Meta Integration** - Send typing status to Instagram/Messenger
4. **Phase 4: WhatsApp** - Send read receipts (best available option)
5. **Phase 5: Timeout Handling** - Add error state and retry functionality

## Dependencies

- WhatsApp Business API access (already configured)
- Meta Graph API access (already configured)
- Convex real-time subscriptions (already in use)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WhatsApp doesn't support typing | Medium | Use read receipts, document limitation |
| Meta typing expires after 20s | Low | Re-send typing status for long processing |
| Race condition: response before indicator | Low | Use Convex transactions for atomic updates |
| Timeout too aggressive | Medium | Make timeout configurable per business |
