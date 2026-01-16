# 06 - Conversation Dashboard - Product Requirements Document

## Overview
A real-time dashboard where business owners can view all customer conversations, see AI handling messages, monitor escalations, and take over conversations when needed.

## Problem Statement
Business owners need to:
1. See what's happening with their customers in real-time
2. Trust but verify AI responses
3. Jump in when AI escalates or when they want to
4. Have full context when taking over a conversation

This is the "cockpit" for monitoring and controlling Echo.

## Goals
- Real-time conversation list with status indicators
- Full conversation view with message history
- Seamless human takeover (AI pauses, human types)
- Hand back to AI when human is done
- Escalation alerts and notifications
- Mobile-friendly (business owners often on phone)

## Non-Goals (Out of Scope)
- Team collaboration (multiple humans per conversation) (later)
- Canned responses / macros (later)
- Conversation analytics (later, separate feature)
- Customer profiles / CRM (later)
- Conversation assignment rules (later)

## User Stories

### Story 1: View Conversation List
**As a** business owner  
**I want** to see all my customer conversations  
**So that** I know what's happening

**Acceptance Criteria:**
- [ ] List shows all conversations sorted by last activity
- [ ] Each row shows: customer name/phone, last message preview, time, status badge
- [ ] Status badges: "AI Handling" (green), "Escalated" (red), "Human Active" (blue), "Closed" (gray)
- [ ] Real-time updates when new messages arrive
- [ ] Unread indicator for new messages
- [ ] Filter by status (All, Escalated, Active, Closed)
- [ ] Search by customer phone or name

### Story 2: View Conversation Detail
**As a** business owner  
**I want** to see the full conversation history  
**So that** I understand the context

**Acceptance Criteria:**
- [ ] Click conversation to open detail view
- [ ] Shows all messages in chat bubble format
- [ ] Clear visual distinction: customer (left), AI (right, labeled), human (right, different style)
- [ ] Messages show timestamp
- [ ] Shows order info if order was created
- [ ] Shows escalation reason if escalated
- [ ] Scrolls to bottom (most recent) by default
- [ ] Real-time updates as new messages arrive

### Story 3: Take Over Conversation
**As a** business owner  
**I want** to take over from the AI  
**So that** I can handle the customer personally

**Acceptance Criteria:**
- [ ] "Take Over" button in conversation view
- [ ] When clicked: AI stops responding, human can type
- [ ] Customer sees no interruption (seamless transition)
- [ ] Conversation status changes to "Human Active"
- [ ] Message input field becomes active
- [ ] All subsequent messages go directly to human (not AI)

### Story 4: Send Message as Human
**As a** business owner who took over  
**I want** to send messages to the customer  
**So that** I can help them

**Acceptance Criteria:**
- [ ] Text input at bottom of conversation view
- [ ] Send button (and Enter key) sends message
- [ ] Message appears in conversation immediately
- [ ] Message sent via WhatsApp to customer
- [ ] Message marked as "from human" in history
- [ ] Support sending images (upload or paste)

### Story 5: Hand Back to AI
**As a** business owner  
**I want** to hand the conversation back to AI  
**So that** I can focus on other things

**Acceptance Criteria:**
- [ ] "Hand Back to AI" button (visible when human is active)
- [ ] Confirmation: "AI will resume handling this conversation"
- [ ] AI sends a re-engagement message (optional, configurable)
- [ ] Conversation status changes back to "AI Handling"
- [ ] Subsequent customer messages processed by AI

### Story 6: Handle Escalation
**As a** business owner  
**I want** to be notified when AI escalates  
**So that** I can help the customer quickly

**Acceptance Criteria:**
- [ ] Escalated conversations appear at top of list
- [ ] Red "Escalated" badge clearly visible
- [ ] Shows escalation reason (e.g., "Customer requested human")
- [ ] Browser notification when escalation happens (if permitted)
- [ ] Sound alert option (configurable)
- [ ] Taking over clears escalation status

### Story 7: Close Conversation
**As a** business owner  
**I want** to close completed conversations  
**So that** my list stays manageable

**Acceptance Criteria:**
- [ ] "Close" button in conversation view
- [ ] Closed conversations move to bottom / separate tab
- [ ] If customer messages again, conversation re-opens automatically
- [ ] Closed conversations still searchable/viewable

### Story 8: View on Mobile
**As a** business owner on the go  
**I want** to check conversations on my phone  
**So that** I can respond from anywhere

**Acceptance Criteria:**
- [ ] Fully responsive layout
- [ ] Conversation list works on small screens
- [ ] Conversation detail is full-screen on mobile
- [ ] Back button to return to list
- [ ] Touch-friendly buttons and inputs
- [ ] Works offline (shows cached conversations, syncs when online)

## Technical Requirements

### Real-Time Architecture
Convex provides real-time subscriptions out of the box. Use `useQuery` hooks that automatically update when data changes.

```typescript
// Frontend
const conversations = useQuery(api.conversations.list, { 
  businessId, 
  status: filter 
});

// This automatically updates when any conversation changes
```

### Optimistic Updates
When human sends a message:
1. Immediately show message in UI (optimistic)
2. Save to Convex
3. Trigger WhatsApp send
4. Update with delivery status when confirmed

### API Endpoints (Convex Functions)

```typescript
// Queries (real-time)
conversations.list({ businessId, status?, search?, limit?, cursor? })
conversations.get({ conversationId })
conversations.messages({ conversationId, limit?, cursor? })

// Mutations
conversations.takeOver({ conversationId })  // Human takes over
conversations.handBack({ conversationId })  // Give back to AI
conversations.close({ conversationId })
conversations.reopen({ conversationId })

// Messages from human
messages.sendAsHuman({ conversationId, content, mediaUrl? })
```

### Notification System
```typescript
// When escalation happens, trigger notification
// Option 1: Browser Push Notifications
// Option 2: In-app notification bell with count
// Option 3: Email notification (for critical escalations)
```

## Data Model

### Updates to `conversations` table
| Field | Type | Description |
|-------|------|-------------|
| assignedTo | Id<"users"> \| null | null = AI, userId = human |
| status | string | "active" \| "escalated" \| "closed" |
| escalationReason | string | Why escalated |
| lastReadAt | number | For unread indicator |
| closedAt | number | When closed |

### `notifications` table (optional for MVP)
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Convex document ID |
| userId | Id<"users"> | Recipient |
| type | string | "escalation" \| "new_order" |
| conversationId | Id<"conversations"> | Related conversation |
| read | boolean | Has user seen it |
| createdAt | number | Timestamp |

## UI/UX

### Pages
1. `/conversations` - Main conversation list + detail (split view on desktop)
2. On mobile: `/conversations` shows list, `/conversations/[id]` shows detail

### Layout (Desktop)
```
┌─────────────────────────────────────────────────────────────┐
│  Echo Dashboard                     [Notifications] [User]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌──────────────────────────────────┐ │
│  │ Conversations   │  │  Juan García (+57 300 123 4567)  │ │
│  │                 │  │  AI Handling ●                    │ │
│  │ [Filter: All ▼] │  ├──────────────────────────────────┤ │
│  │                 │  │                                  │ │
│  │ ● Juan García   │  │  [Customer] Hola, quiero pedir   │ │
│  │   Quiero pedir  │  │                                  │ │
│  │   2m ago        │  │  [AI] ¡Hola! Con gusto te ayudo  │ │
│  │                 │  │                                  │ │
│  │ ● Maria Lopez   │  │  [Customer] Una hamburguesa      │ │
│  │   Gracias!      │  │                                  │ │
│  │   15m ago       │  │  [AI] Perfecto, agregué...       │ │
│  │                 │  │                                  │ │
│  │ 🔴 Pedro Ruiz   │  │                                  │ │
│  │   ESCALATED     │  │                                  │ │
│  │   1h ago        │  ├──────────────────────────────────┤ │
│  │                 │  │  [Take Over]  [Close]            │ │
│  │                 │  │  [Message input...        ] [▶]  │ │
│  └─────────────────┘  └──────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Layout (Mobile)
- Single column
- List view first
- Tap to open conversation full-screen
- Back arrow to return to list

### Components
- `ConversationList` - Filterable, searchable list
- `ConversationItem` - Single row in list
- `ConversationDetail` - Full conversation view
- `MessageBubble` - Single message (customer/AI/human variants)
- `MessageInput` - Text input + send button
- `StatusBadge` - Visual status indicator
- `EscalationAlert` - Prominent alert for escalated convos
- `NotificationBell` - Header notification indicator

### Design Notes
- Use real-time data (no manual refresh)
- Prominent escalation visibility (can't miss it)
- Fast switching between conversations
- Clear visual hierarchy (who said what, when)
- Minimal UI when AI is handling well
- Action buttons only appear when relevant

## Success Metrics
- Human response time to escalation < 5 minutes
- Dashboard load time < 2s
- Message send latency < 1s
- Mobile usability score > 80

## Dependencies
- Feature 01 (Business Onboarding) - auth, business context
- Feature 03 (WhatsApp Integration) - message send/receive
- Feature 04 (AI Engine) - conversation handling

## Accessibility
- Keyboard navigation for conversation switching
- Screen reader support for message history
- High contrast mode support
- Focus indicators on interactive elements

## Open Questions
- Should we support multiple businesses in dashboard switcher?
- Audio notifications - on by default or off?
- Should closed conversations auto-archive after X days?
- Do we need read receipts (seen by business owner)?
