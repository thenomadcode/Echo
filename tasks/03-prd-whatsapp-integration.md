# 03 - WhatsApp Integration - Product Requirements Document

## Overview
Connect Echo to WhatsApp Business API via a BSP (Business Solution Provider) to receive and send messages. This is the messaging backbone that enables all customer conversations.

## Problem Statement
Customers message businesses on WhatsApp. For Echo to:
1. Receive those messages
2. Process them with AI
3. Send responses back

We need to integrate with WhatsApp Business API. Direct Meta integration is complex, so we'll use a BSP (Twilio, 360dialog, or similar) to simplify.

## Goals
- Receive WhatsApp messages via webhook
- Send WhatsApp messages (text, images, buttons, lists)
- Support multiple businesses, each with their own WhatsApp number
- Handle WhatsApp-specific features (message templates, 24h window)
- Abstract the BSP layer so we can switch providers later

## Non-Goals (Out of Scope)
- Other channels (Instagram, Messenger, TikTok) - later
- WhatsApp voice/video calls
- WhatsApp Status updates
- WhatsApp Business catalog (we have our own)
- Bulk messaging / broadcast campaigns

## User Stories

### Story 1: Connect WhatsApp Number
**As a** business owner  
**I want** to connect my WhatsApp Business number to Echo  
**So that** Echo can handle my customer messages

**Acceptance Criteria:**
- [ ] Settings page shows WhatsApp connection status
- [ ] Clear instructions for setting up via BSP
- [ ] Input fields for BSP credentials (API key, phone number ID)
- [ ] Test connection button to verify setup
- [ ] Success/error feedback
- [ ] Connection status visible in dashboard

### Story 2: Receive Customer Message
**As the** Echo system  
**I want** to receive incoming WhatsApp messages  
**So that** I can process and respond to customers

**Acceptance Criteria:**
- [ ] Webhook endpoint receives BSP payload
- [ ] Verify webhook signature for security
- [ ] Parse message: sender phone, content, timestamp, media
- [ ] Create or find existing conversation for this customer
- [ ] Store message in database
- [ ] Trigger AI processing (or queue for processing)
- [ ] Handle message types: text, image, voice, document

### Story 3: Send Text Response
**As the** Echo system  
**I want** to send text messages back to customers  
**So that** they receive AI responses

**Acceptance Criteria:**
- [ ] Send plain text messages via BSP API
- [ ] Handle rate limits gracefully
- [ ] Retry failed sends with backoff
- [ ] Mark message as sent/delivered/read (if BSP provides status)
- [ ] Store sent messages in conversation

### Story 4: Send Rich Messages
**As the** Echo system  
**I want** to send buttons and lists  
**So that** customers can interact easily

**Acceptance Criteria:**
- [ ] Send interactive button messages (up to 3 buttons)
- [ ] Send list messages (for product selection)
- [ ] Send image messages (product images)
- [ ] Fallback to text if rich message fails

### Story 5: Handle 24-Hour Window
**As the** Echo system  
**I want** to respect WhatsApp's 24-hour messaging window  
**So that** we don't violate platform rules

**Acceptance Criteria:**
- [ ] Track last customer message timestamp
- [ ] Within 24h: send any message type
- [ ] After 24h: only send approved templates
- [ ] Have at least one "re-engagement" template approved
- [ ] UI shows when window is about to expire

### Story 6: Webhook Status Updates
**As the** Echo system  
**I want** to receive message status updates  
**So that** I know if messages were delivered/read

**Acceptance Criteria:**
- [ ] Receive status webhooks (sent, delivered, read, failed)
- [ ] Update message status in database
- [ ] Show delivery status in conversation view

## Technical Requirements

### BSP Selection
For MVP, support **one** BSP with abstraction for others later.

**Recommended: Twilio**
- Well-documented
- Easy sandbox for development
- Reasonable pricing
- Good LATAM coverage

**Alternative: 360dialog**
- Cheaper
- Popular in LATAM
- Less polished docs

### Architecture
```
[WhatsApp] ←→ [BSP (Twilio)] ←→ [Echo Webhook] ←→ [Convex]
```

### Webhook Endpoint
Convex HTTP endpoint to receive webhooks:
```typescript
// packages/backend/convex/http.ts
http.route({
  path: "/webhook/whatsapp",
  method: "POST",
  handler: whatsappWebhookHandler,
});
```

### BSP Abstraction Layer
```typescript
// packages/backend/convex/integrations/whatsapp/types.ts
interface WhatsAppProvider {
  sendText(to: string, message: string): Promise<MessageResult>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageResult>;
  sendButtons(to: string, body: string, buttons: Button[]): Promise<MessageResult>;
  sendList(to: string, body: string, sections: ListSection[]): Promise<MessageResult>;
  parseWebhook(payload: unknown): ParsedMessage;
  verifyWebhook(payload: unknown, signature: string): boolean;
}

// packages/backend/convex/integrations/whatsapp/twilio.ts
class TwilioWhatsAppProvider implements WhatsAppProvider { ... }

// packages/backend/convex/integrations/whatsapp/360dialog.ts (later)
class Dialog360Provider implements WhatsAppProvider { ... }
```

### Environment Variables
```bash
WHATSAPP_PROVIDER=twilio  # or "360dialog"
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WEBHOOK_VERIFY_TOKEN=random_string_for_webhook_verification
```

### API Endpoints (Convex Functions)

```typescript
// HTTP routes (webhooks)
http.whatsappWebhook  // POST - receive messages
http.whatsappWebhookVerify  // GET - webhook verification (Meta requirement)

// Internal mutations (called by webhook handler)
whatsapp.processIncomingMessage({ businessId, from, content, timestamp, mediaUrl? })
whatsapp.updateMessageStatus({ messageId, status })

// Actions (external API calls)
whatsapp.sendMessage({ conversationId, content, type: "text" | "image" | "buttons" | "list" })

// Queries
whatsapp.getConnectionStatus({ businessId })

// Mutations (business setup)
whatsapp.saveCredentials({ businessId, provider, credentials })
whatsapp.testConnection({ businessId })
```

## Data Model

### `whatsappConnections` table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| businessId | Id<"businesses"> | yes | Parent business |
| provider | string | yes | "twilio" \| "360dialog" |
| phoneNumberId | string | yes | WhatsApp phone number ID |
| phoneNumber | string | yes | Display phone number |
| credentials | object | yes | Encrypted BSP credentials |
| verified | boolean | yes | Connection verified working |
| createdAt | number | yes | Timestamp |

### Updates to `conversations` table (from base schema)
| Field | Type | Description |
|-------|------|-------------|
| channel | string | "whatsapp" (for now, only option) |
| channelId | string | Customer's WhatsApp number |
| lastCustomerMessageAt | number | For 24h window tracking |

### Updates to `messages` table
| Field | Type | Description |
|-------|------|-------------|
| externalId | string | BSP's message ID |
| deliveryStatus | string | "sent" \| "delivered" \| "read" \| "failed" |
| mediaUrl | string | URL if message contains media |
| mediaType | string | "image" \| "voice" \| "document" |

### Indexes
- `whatsappConnections.by_business`: [businessId]
- `whatsappConnections.by_phone`: [phoneNumber] - find business by incoming number

## UI/UX

### Pages
1. `/settings/whatsapp` - WhatsApp connection setup

### Components
- `WhatsAppSetup` - Step-by-step connection wizard
- `ConnectionStatus` - Shows connected/disconnected state
- `TestConnection` - Button to send test message

### Setup Flow
```
1. Choose BSP (Twilio recommended)
2. Create BSP account (external link with instructions)
3. Get WhatsApp Business number approved
4. Enter API credentials in Echo
5. Configure webhook URL in BSP dashboard
6. Test connection
7. Done!
```

### Design Notes
- Show clear status: Connected (green) / Not Connected (red)
- Provide copy-paste webhook URL
- Link to BSP documentation
- Show last message received timestamp to confirm working

## Success Metrics
- Webhook response time < 500ms
- Message delivery success rate > 99%
- Zero lost messages

## Dependencies
- Feature 01 (Business Onboarding) - need business context
- BSP account setup (external, business owner does this)

## Security Considerations
- Verify webhook signatures to prevent spoofing
- Encrypt stored BSP credentials
- Rate limit webhook endpoint
- Log all incoming/outgoing for audit

## Open Questions
- Which BSP to recommend/support first?
- Do we need to support WhatsApp Cloud API directly (no BSP)?
- How to handle businesses that already have WhatsApp Business app (not API)?
