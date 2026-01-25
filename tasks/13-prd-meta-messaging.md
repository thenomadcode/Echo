# 13 - Meta Messaging Integration - Product Requirements Document

## Overview
Unified integration with Meta's Messenger Platform to receive and send messages via Instagram DM and Facebook Messenger. This extends Echo's channel capabilities beyond WhatsApp to capture the significant creator/influencer audience that communicates primarily through Meta's platforms.

## Problem Statement
Echo's target customers - creators, influencers, and online sellers - receive a large volume of customer inquiries through Instagram DM and Facebook Messenger. Currently:

1. These messages go unanswered or require manual monitoring
2. Sales opportunities are lost when creators can't respond 24/7
3. No AI assistance is available for Meta messaging channels

Meta provides a unified API (Messenger Platform) that handles both Instagram DM and Facebook Messenger through a single integration. This is simpler than WhatsApp because:
- **No BSP required** - Direct Meta Graph API access
- **Single OAuth flow** - One authentication connects both channels
- **Development Mode** - Full testing without App Review

## Goals
- Receive and respond to Instagram DMs via webhook
- Receive and respond to Facebook Messenger messages via webhook
- Single OAuth flow that connects both Instagram and Messenger
- Support Development Mode for testing (no App Review initially)
- Same provider abstraction pattern as WhatsApp integration
- Seamless integration with existing AI conversation engine
- Support rich message types (images, quick replies where available)
- Respect 24-hour messaging window rules

## Non-Goals (Out of Scope)
- Instagram Story replies/reactions
- Instagram comments (only Direct Messages)
- Facebook Page posts/comments
- Meta Business Suite features
- Ads integration (Click-to-Messenger ads)
- Voice/video calls
- Message templates (Meta's template system differs from WhatsApp)
- Broadcast/bulk messaging
- Instagram Shopping integration
- App Review process (documented but not required for MVP)

## User Stories

### Story 1: Connect Meta Account
**As a** business owner  
**I want** to connect my Instagram and Facebook accounts to Echo  
**So that** Echo can handle customer messages from both platforms

**Acceptance Criteria:**
- [ ] Settings page shows "Connect with Facebook" button
- [ ] OAuth flow requests correct permissions (instagram_basic, instagram_manage_messages, pages_messaging, pages_manage_metadata)
- [ ] After OAuth, shows which Instagram account(s) and Page(s) were connected
- [ ] Stores access tokens securely (encrypted)
- [ ] Automatically subscribes to messaging webhooks
- [ ] Test message button to verify connection works
- [ ] Shows connection status with last message timestamp
- [ ] Supports disconnecting/reconnecting accounts
- [ ] Clear error messages if OAuth fails or permissions denied

### Story 2: Receive Instagram DM
**As the** Echo system  
**I want** to receive incoming Instagram Direct Messages  
**So that** I can process and respond to customers

**Acceptance Criteria:**
- [ ] Webhook endpoint receives Instagram DM payload (object: "instagram")
- [ ] Verify webhook signature using App Secret
- [ ] Parse message: sender IGSID, content, timestamp, media
- [ ] Map IGSID to correct business via connected Instagram account
- [ ] Create or find existing conversation (channel: "instagram")
- [ ] Store message in database with correct channelId
- [ ] Trigger AI processing for text messages
- [ ] Handle message types: text, image, video, audio, story_mention, story_reply
- [ ] Handle "unsend" events (message deleted by sender)

### Story 3: Receive Messenger Message
**As the** Echo system  
**I want** to receive incoming Facebook Messenger messages  
**So that** I can process and respond to customers

**Acceptance Criteria:**
- [ ] Webhook endpoint receives Messenger payload (object: "page")
- [ ] Verify webhook signature using App Secret
- [ ] Parse message: sender PSID, content, timestamp, media
- [ ] Map PSID to correct business via connected Facebook Page
- [ ] Create or find existing conversation (channel: "messenger")
- [ ] Store message in database with correct channelId
- [ ] Trigger AI processing for text messages
- [ ] Handle message types: text, image, video, audio, file, sticker
- [ ] Handle postback events (button clicks)

### Story 4: Send Text Response
**As the** Echo system  
**I want** to send text messages back to customers  
**So that** they receive AI responses

**Acceptance Criteria:**
- [ ] Send text via Meta Send API (POST /{page_or_ig_id}/messages)
- [ ] Use correct recipient ID (PSID for Messenger, IGSID for Instagram)
- [ ] Include messaging_type: "RESPONSE" for replies within 24h window
- [ ] Handle rate limits gracefully (200 calls/hour limit)
- [ ] Retry failed sends with exponential backoff
- [ ] Store sent messages in conversation
- [ ] Track message ID (mid) for status updates

### Story 5: Send Rich Messages
**As the** Echo system  
**I want** to send images and quick replies  
**So that** customers can interact easily

**Acceptance Criteria:**
- [ ] Send image messages with optional caption (both platforms)
- [ ] Send quick reply buttons (Messenger only - up to 13 buttons)
- [ ] Send generic templates for product cards (Messenger only)
- [ ] Graceful fallback to text for unsupported message types on Instagram
- [ ] Handle media upload vs URL-based media
- [ ] Respect platform-specific limitations

### Story 6: Handle 24-Hour Messaging Window
**As the** Echo system  
**I want** to respect Meta's messaging window rules  
**So that** we don't violate platform policies

**Acceptance Criteria:**
- [ ] Track last customer message timestamp per conversation
- [ ] Within 24h: send using messaging_type: "RESPONSE"
- [ ] After 24h: only send if using valid Message Tag (limited scenarios)
- [ ] UI indicator shows when window is about to expire
- [ ] Log attempts to send outside window for debugging
- [ ] Consider One-Time Notification (OTN) request flow for future re-engagement

### Story 7: Receive Status Updates
**As the** Echo system  
**I want** to receive message delivery status updates  
**So that** I know if messages were delivered/read

**Acceptance Criteria:**
- [ ] Subscribe to message_deliveries webhook field
- [ ] Subscribe to message_reads webhook field
- [ ] Update message deliveryStatus in database
- [ ] Show delivery status in conversation view
- [ ] Handle message_echoes (confirmation of sent messages)

## Technical Requirements

### Meta App Configuration

**App Type:** Business App (required for messaging)

**Products to Add:**
1. Messenger (includes Instagram Messaging features)
2. Webhooks
3. Facebook Login for Business

**Development Mode Setup:**
1. Create Meta Developer account
2. Create new Business App
3. Add Messenger product
4. Configure webhook callback URL
5. Add test users (developers, testers) to app roles
6. Test users can connect their Instagram/Pages without App Review

### OAuth 2.0 Flow (Facebook Login for Business)

**Authorization URL:**
```
https://www.facebook.com/v19.0/dialog/oauth?
  client_id={app-id}
  &redirect_uri={redirect-uri}
  &scope={permissions}
  &state={state-param}
```

**Required Scopes:**
```
instagram_basic
instagram_manage_messages
pages_messaging
pages_manage_metadata
pages_show_list
```

**Token Exchange:**
```
POST https://graph.facebook.com/v19.0/oauth/access_token
  ?client_id={app-id}
  &redirect_uri={redirect-uri}
  &client_secret={app-secret}
  &code={code-from-oauth}
```

**Long-Lived Token Exchange:**
```
GET https://graph.facebook.com/v19.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-token}
```

**Get Connected Pages and Instagram Accounts:**
```
GET https://graph.facebook.com/v19.0/me/accounts
  ?fields=id,name,access_token,instagram_business_account{id,username}
  &access_token={user-access-token}
```

### Required Permissions

| Permission | Access Level | Purpose |
|------------|--------------|---------|
| instagram_basic | Standard | Get Instagram account info |
| instagram_manage_messages | Advanced | Read/send Instagram DMs |
| pages_messaging | Standard | Send Messenger messages |
| pages_manage_metadata | Standard | Webhook subscriptions |
| pages_show_list | Standard | List user's Pages |

**Note:** Advanced Access requires App Review. For Development Mode testing, Standard Access with app role users is sufficient.

### Webhook Configuration

**Single Endpoint Pattern:**
```
/webhook/meta  (handles both Instagram and Messenger)
```

**Webhook Verification (GET request):**
```typescript
// Query params from Meta
hub.mode = "subscribe"
hub.verify_token = YOUR_VERIFY_TOKEN
hub.challenge = CHALLENGE_NUMBER

// Response: echo back hub.challenge if token matches
```

**Webhook Fields to Subscribe:**
| Object | Field | Purpose |
|--------|-------|---------|
| page | messages | Incoming Messenger messages |
| page | message_deliveries | Delivery receipts |
| page | message_reads | Read receipts |
| page | messaging_postbacks | Button clicks |
| instagram | messages | Incoming Instagram DMs |
| instagram | message_reactions | Reactions to messages |

### Webhook Payload Formats

**Instagram DM Payload:**
```json
{
  "object": "instagram",
  "entry": [{
    "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
    "time": 1569262486134,
    "messaging": [{
      "sender": { "id": "INSTAGRAM_SCOPED_ID" },
      "recipient": { "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID" },
      "timestamp": 1569262485349,
      "message": {
        "mid": "MESSAGE_ID",
        "text": "Hello from Instagram!"
      }
    }]
  }]
}
```

**Instagram DM with Media:**
```json
{
  "object": "instagram",
  "entry": [{
    "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
    "time": 1569262486134,
    "messaging": [{
      "sender": { "id": "INSTAGRAM_SCOPED_ID" },
      "recipient": { "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID" },
      "timestamp": 1569262485349,
      "message": {
        "mid": "MESSAGE_ID",
        "attachments": [{
          "type": "image",
          "payload": {
            "url": "https://cdn.example.com/image.jpg"
          }
        }]
      }
    }]
  }]
}
```

**Messenger Payload:**
```json
{
  "object": "page",
  "entry": [{
    "id": "PAGE_ID",
    "time": 1458692752478,
    "messaging": [{
      "sender": { "id": "PAGE_SCOPED_ID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1458692752478,
      "message": {
        "mid": "mid.1457764197618:41d102a3e1ae206a38",
        "text": "Hello from Messenger!"
      }
    }]
  }]
}
```

**Status Update Payload (Messenger):**
```json
{
  "object": "page",
  "entry": [{
    "id": "PAGE_ID",
    "time": 1458692752478,
    "messaging": [{
      "sender": { "id": "PAGE_SCOPED_ID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1458692752478,
      "delivery": {
        "mids": ["mid.xxx"],
        "watermark": 1458692752478
      }
    }]
  }]
}
```

### Provider Abstraction

```typescript
// packages/backend/convex/integrations/meta/types.ts

export type MetaChannel = "instagram" | "messenger";

export interface MetaMessagingProvider {
  // Send messages
  sendText(recipientId: string, message: string): Promise<MessageResult>;
  sendImage(recipientId: string, imageUrl: string, caption?: string): Promise<MessageResult>;
  sendQuickReplies(
    recipientId: string, 
    text: string, 
    quickReplies: QuickReply[]
  ): Promise<MessageResult>;
  
  // Webhook parsing
  parseWebhook(payload: unknown): ParsedMetaMessage | null;
  isStatusUpdate(payload: unknown): boolean;
  parseStatusUpdate(payload: unknown): StatusUpdate | null;
  
  // Webhook verification
  verifyWebhook(payload: string, signature: string, appSecret: string): boolean;
}

export interface ParsedMetaMessage {
  channel: MetaChannel;
  businessAccountId: string;  // Instagram account ID or Page ID
  senderId: string;           // IGSID or PSID
  content: string;
  timestamp: number;
  messageId: string;          // mid
  messageType: "text" | "image" | "video" | "audio" | "file" | "sticker" | "story_mention";
  mediaUrl?: string;
  isEcho?: boolean;           // Message sent by us (echo)
}

export interface QuickReply {
  content_type: "text";
  title: string;
  payload: string;
}
```

```typescript
// packages/backend/convex/integrations/meta/provider.ts
export class MetaMessagingProviderImpl implements MetaMessagingProvider {
  constructor(
    private pageAccessToken: string,
    private pageOrIgId: string,
    private channel: MetaChannel
  ) {}
  
  async sendText(recipientId: string, message: string): Promise<MessageResult> {
    const url = `https://graph.facebook.com/v19.0/${this.pageOrIgId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.pageAccessToken}`
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: "RESPONSE",
        message: { text: message }
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message };
    }
    
    const result = await response.json();
    return { success: true, messageId: result.message_id };
  }
  
  // ... other methods
}
```

### Environment Variables

```bash
# Meta App Configuration
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_WEBHOOK_VERIFY_TOKEN=random_string_for_webhook_verification

# OAuth redirect (same as site URL)
# Uses SITE_URL or CONVEX_SITE_URL from existing config
```

### API Endpoints (Convex Functions)

```typescript
// HTTP routes (webhooks and OAuth)
http.route({
  path: "/webhook/meta",
  method: "GET",
  handler: metaWebhookVerify,  // Webhook verification
});

http.route({
  path: "/webhook/meta", 
  method: "POST",
  handler: metaWebhookHandler,  // Incoming messages
});

http.route({
  path: "/meta/callback",
  method: "GET", 
  handler: metaOAuthCallback,  // OAuth callback
});

// Queries
meta.getConnectionStatus({ businessId })
meta.getConnectedAccounts({ businessId })

// Mutations  
meta.saveConnection({ businessId, pageId, instagramAccountId, accessToken, ... })
meta.disconnect({ businessId, connectionId })

// Internal mutations (called by webhook handler)
internal.meta.webhook.processIncomingMessage({ ... })
internal.meta.webhook.updateMessageStatus({ ... })

// Actions (external API calls)
meta.sendMessage({ conversationId, content, type })
meta.startOAuth({ businessId })  // Generate OAuth URL with state
meta.exchangeToken({ code, state })  // Handle OAuth callback
meta.subscribeWebhooks({ connectionId })  // Subscribe Page/IG to webhooks
meta.testConnection({ businessId })
```

### Integration with AI Engine

The webhook handler follows the same pattern as WhatsApp:

```typescript
// In http.ts - metaWebhookHandler
async function metaWebhookHandler(ctx, request) {
  const payload = await request.json();
  const signature = request.headers.get("X-Hub-Signature-256");
  
  // Verify signature
  if (!verifyMetaSignature(payload, signature, META_APP_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }
  
  const object = payload.object; // "page" or "instagram"
  
  for (const entry of payload.entry) {
    for (const event of entry.messaging) {
      // Skip echoes (our own messages)
      if (event.message?.is_echo) continue;
      
      // Determine channel
      const channel = object === "instagram" ? "instagram" : "messenger";
      
      // Find business by account ID
      const businessLookup = await ctx.runMutation(
        internal.meta.webhook.getBusinessByAccountId,
        { accountId: entry.id, channel }
      );
      
      if (!businessLookup) continue;
      
      // Store incoming message
      const messageResult = await ctx.runMutation(
        internal.meta.webhook.processIncomingMessage,
        {
          businessId: businessLookup.businessId,
          channel,
          senderId: event.sender.id,
          content: event.message?.text || "",
          messageType: detectMessageType(event.message),
          externalId: event.message?.mid,
          mediaUrl: extractMediaUrl(event.message),
          timestamp: event.timestamp,
        }
      );
      
      // Trigger AI processing for text messages
      if (event.message?.text) {
        const aiResult = await ctx.runAction(api.ai.process.processMessage, {
          conversationId: messageResult.conversationId,
          message: event.message.text,
        });
        
        // Send AI response back
        await ctx.runAction(api.integrations.meta.actions.sendMessage, {
          conversationId: messageResult.conversationId,
          content: aiResult.response,
          type: "text",
        });
      }
    }
  }
  
  return new Response("OK", { status: 200 });
}
```

## Data Model

### `metaConnections` table

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| _id | Id | auto | Convex document ID |
| businessId | Id<"businesses"> | yes | Parent business |
| pageId | string | yes | Facebook Page ID |
| pageName | string | yes | Facebook Page name |
| pageAccessToken | string | yes | Long-lived Page access token (encrypted) |
| instagramAccountId | string | no | Connected Instagram Business account ID |
| instagramUsername | string | no | Instagram username for display |
| permissions | array | yes | Granted OAuth permissions |
| webhooksSubscribed | boolean | yes | Whether webhooks are configured |
| verified | boolean | yes | Connection verified working |
| lastMessageAt | number | no | Timestamp of last received message |
| tokenExpiresAt | number | no | Token expiration (if applicable) |
| createdAt | number | yes | Timestamp |
| updatedAt | number | yes | Timestamp |

**Indexes:**
- `by_business`: [businessId]
- `by_page`: [pageId] - find business by incoming Page webhook
- `by_instagram`: [instagramAccountId] - find business by incoming IG webhook

### Updates to `conversations` table

| Field | Existing Type | Updated Type |
|-------|--------------|--------------|
| channel | "whatsapp" | "whatsapp" \| "instagram" \| "messenger" |

**Note:** `channelId` stores IGSID for Instagram, PSID for Messenger (same field, different ID formats).

### Updates to `messages` table

No schema changes needed - existing fields support Meta messages:
- `externalId` = message mid
- `deliveryStatus` = "sent" | "delivered" | "read" | "failed"
- `mediaUrl` = attachment URL
- `mediaType` = "image" | "video" | "audio" | "file"

### Schema Definition

```typescript
// Add to schema.ts

metaConnections: defineTable({
  businessId: v.id("businesses"),
  pageId: v.string(),
  pageName: v.string(),
  pageAccessToken: v.string(),
  instagramAccountId: v.optional(v.string()),
  instagramUsername: v.optional(v.string()),
  permissions: v.array(v.string()),
  webhooksSubscribed: v.boolean(),
  verified: v.boolean(),
  lastMessageAt: v.optional(v.number()),
  tokenExpiresAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_business", ["businessId"])
  .index("by_page", ["pageId"])
  .index("by_instagram", ["instagramAccountId"]),

// Update conversations table channel field validator
conversations: defineTable({
  // ... existing fields
  channel: v.union(
    v.literal("whatsapp"),
    v.literal("instagram"),
    v.literal("messenger")
  ),
  // ... rest of fields
})
```

## UI/UX

### Pages

1. `/settings/integrations/meta` - Meta connection setup and status

### Components

- `MetaConnectButton` - Initiates OAuth flow with Facebook Login
- `MetaConnectionStatus` - Shows connected Pages and Instagram accounts
- `MetaChannelList` - Lists all connected channels with status indicators
- `MetaDisconnectDialog` - Confirmation dialog for disconnecting

### Setup Flow

```
1. Navigate to Settings > Integrations > Meta
2. Click "Connect with Facebook" button
3. [Redirect to Facebook] Choose Page(s) to connect
4. [Redirect to Facebook] Grant requested permissions
5. [Redirect back to Echo] 
   - If Instagram linked to Page: both channels connected
   - If no Instagram: only Messenger connected
6. Automatic webhook subscription
7. [Optional] Send test message
8. Connection active - ready to receive messages
```

### Design Notes

**Connection Status Card:**
```
+----------------------------------------+
| Meta Connection                    [Connected] |
+----------------------------------------+
| Facebook Page: "My Business Page"      |
| Instagram: @mybusiness                 |
|                                        |
| Last message: 2 minutes ago            |
| Webhooks: Active                       |
|                                        |
| [Test Connection] [Disconnect]         |
+----------------------------------------+
```

**Channel Selection (if multiple Pages):**
- Show list of all Pages user has access to
- Checkbox to select which to connect
- Show linked Instagram accounts per Page

**Error States:**
- OAuth cancelled: "Connection cancelled. Click to try again."
- Permissions denied: "Missing required permissions. Please grant all permissions to connect."
- Token expired: "Connection expired. Please reconnect."
- Webhook failure: "Webhook setup failed. Click to retry."

### Navigation

Add to Settings > Integrations:
```
Integrations
├── WhatsApp     [Connected]
├── Meta         [Not Connected]  <-- New
└── Shopify      [Connected]
```

## Development Mode vs Production

### Development Mode (MVP)

**What Works:**
- Full OAuth flow with test users
- Webhook delivery for test accounts
- Send/receive messages
- All API endpoints

**Limitations:**
- Only accounts with app roles (Admin, Developer, Tester) can connect
- Maximum 50 test users
- No Advanced Access permissions (use Standard Access)
- "In Development" banner shows in connected apps

**Setup Steps:**
1. Create Meta Developer Account
2. Create Business App
3. Add "Messenger" product
4. Configure webhook URL: `https://your-deployment.convex.site/webhook/meta`
5. Add team members as Testers in App Roles
6. Each tester logs in with their personal Facebook/Instagram to test

### Production Mode (Post App Review)

**Requirements:**
1. **Business Verification** - Verify your business identity
2. **App Review** - Submit for permission approval:
   - `instagram_manage_messages` (Advanced Access)
   - Screen recording of full user flow
   - Use case documentation
   - Privacy Policy URL
3. **Data Use Checkup** - Confirm data handling compliance

**Timeline:** 2-4 weeks for App Review

**What Changes:**
- Any Instagram Professional account can connect
- Any Facebook Page can connect
- No "In Development" banner
- Higher rate limits (in some cases)

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Webhook response time | < 500ms | P95 latency |
| Message delivery rate | > 99% | Successful sends / total sends |
| OAuth success rate | > 95% | Completed flows / started flows |
| Zero lost messages | 0 | Messages received but not stored |
| AI response time | < 3s | Webhook receive to response sent |

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Feature 01 (Business Onboarding) | Implemented | Need business context |
| Feature 04 (AI Conversation Engine) | Implemented | Plugs into existing AI |
| Feature 06 (Conversation Dashboard) | Implemented | Shows Meta conversations |
| Meta Developer Account | External | Business owner creates |
| Meta Business App | External | Created in Meta Dev portal |

## Security Considerations

### Webhook Signature Verification
All incoming webhooks must be verified using HMAC-SHA256:
```typescript
function verifyMetaSignature(payload: string, signature: string, appSecret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');
  return `sha256=${expectedSignature}` === signature;
}
```

### Token Storage
- Page Access Tokens stored encrypted in database
- Use Convex environment variables for App Secret
- Never log tokens or include in error messages

### Rate Limiting
- Implement rate limiting on webhook endpoint
- Respect Meta's 200 calls/hour API limit
- Queue outgoing messages if approaching limit

### Data Privacy
- Only store message content, not full API responses
- Respect Meta's data retention requirements
- Handle account disconnection gracefully (stop receiving webhooks)

### App Review Considerations
For production (Live Mode with Advanced Access):
- Business Verification required
- Data Use Checkup must be completed
- App Review with use case documentation
- Privacy Policy URL required

## Open Questions

1. **Token Refresh Strategy**
   - Page Access Tokens can be long-lived (60 days) or never-expiring
   - Do we need automatic token refresh flow?
   - Should we alert business owners when token is about to expire?

2. **Multiple Pages/Instagram Accounts**
   - Should one Echo business connect multiple Pages?
   - How to handle if same Instagram is linked to multiple businesses?

3. **Ice-Breaker Messages**
   - Meta supports "ice breaker" quick replies for conversation starters
   - Should we implement this for first-time conversations?

4. **Private Replies**
   - Meta allows replying to public comments via private message
   - Is this in scope for v1?

5. **Handover Protocol**
   - Meta has a Handover Protocol for passing conversations between apps
   - Needed if business uses other tools alongside Echo?

6. **Message Tags**
   - For messaging outside 24h window, Message Tags are required
   - Which tags should we support? (ACCOUNT_UPDATE, CONFIRMED_EVENT_UPDATE, etc.)

7. **App Review Timeline**
   - When should we submit for App Review?
   - What documentation/videos are needed for review?

8. **Instagram API Version**
   - New Instagram API with Instagram Login (July 2024) vs older Facebook Login flow
   - Which approach is better for our use case?
