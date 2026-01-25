/**
 * Meta Platform (Instagram DM / Facebook Messenger) types
 * Based on Meta Graph API v19.0 specifications
 *
 * @see https://developers.facebook.com/docs/messenger-platform/send-messages
 * @see https://developers.facebook.com/docs/instagram-api/guides/messaging
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Meta messaging channels supported by Echo
 * - instagram: Instagram Direct Messages
 * - messenger: Facebook Messenger
 */
export type MetaChannel = "instagram" | "messenger";

/**
 * Message types supported by Meta platforms
 * - text: Plain text message
 * - image: Image attachment
 * - video: Video attachment
 * - audio: Audio/voice attachment
 * - file: Generic file attachment (Messenger only)
 * - sticker: Sticker message (Messenger only)
 * - story_mention: User mentioned business in their story (Instagram only)
 * - story_reply: Reply to a story (Instagram only)
 * - quick_replies: Message with quick reply buttons (Messenger native, Instagram fallback to text)
 * - generic_template: Product cards carousel (Messenger only)
 */
export type MetaMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "sticker"
  | "story_mention"
  | "story_reply"
  | "quick_replies"
  | "generic_template";

/**
 * Delivery status types from Meta webhook status updates
 */
export type MetaDeliveryStatus = "sent" | "delivered" | "read" | "failed";

// ============================================================================
// Quick Replies (Messenger)
// ============================================================================

/**
 * Quick reply button for Messenger
 * Messenger supports up to 13 quick replies per message
 *
 * @see https://developers.facebook.com/docs/messenger-platform/send-messages/quick-replies
 */
export interface QuickReply {
  /** Type of quick reply - "text" for standard text buttons */
  content_type: "text" | "user_phone_number" | "user_email";
  /** Button label text (max 20 characters) */
  title: string;
  /** Payload sent back when button is clicked (max 1000 characters) */
  payload: string;
  /** Optional URL to image icon (24x24 px recommended) */
  image_url?: string;
}

/**
 * Generic template element for product cards (Messenger only)
 * Used for displaying product information in a carousel format
 *
 * @see https://developers.facebook.com/docs/messenger-platform/send-messages/template/generic
 */
export interface GenericTemplateElement {
  title: string;
  subtitle?: string;
  image_url?: string;
  default_action?: {
    type: "web_url";
    url: string;
    webview_height_ratio?: "compact" | "tall" | "full";
  };
  buttons?: GenericTemplateButton[];
}

export interface GenericTemplateButton {
  type: "web_url" | "postback";
  title: string;
  url?: string;
  payload?: string;
}

// ============================================================================
// Message Results
// ============================================================================

/**
 * Result from sending a message via Meta Graph API
 */
export interface MessageResult {
  /** Whether the message was sent successfully */
  success: boolean;
  /** Meta message ID (mid) for tracking delivery status */
  messageId?: string;
  /** Error message if sending failed */
  error?: string;
  /** Error code from Meta API */
  errorCode?: number;
  /** Error subcode for more specific error identification */
  errorSubcode?: number;
}

// ============================================================================
// Status Updates (Webhook)
// ============================================================================

/**
 * Parsed status update from Meta webhook (delivery/read receipts)
 *
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks#message-deliveries
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks#message-reads
 */
export interface StatusUpdate {
  /** The channel this status update is for */
  channel: MetaChannel;
  /** Page ID (Messenger) or Instagram Business Account ID */
  businessAccountId: string;
  /** Recipient PSID (Messenger) or IGSID (Instagram) */
  recipientId: string;
  /** Type of status update */
  type: "delivery" | "read";
  /** Message IDs that were delivered/read (for delivery receipts) */
  messageIds?: string[];
  /** Watermark timestamp - all messages before this were delivered/read */
  watermark: number;
  /** Timestamp of the status update event */
  timestamp: number;
}

// ============================================================================
// Parsed Incoming Messages (Webhook)
// ============================================================================

/**
 * Parsed incoming message from Meta webhook payload
 * Normalizes Instagram DM and Messenger payloads into a common structure
 */
export interface ParsedMetaMessage {
  /** The channel the message came from */
  channel: MetaChannel;
  /** Page ID (Messenger) or Instagram Business Account ID */
  businessAccountId: string;
  /** Sender's PSID (Messenger) or IGSID (Instagram) */
  senderId: string;
  /** Message content (text body or media caption) */
  content: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Meta message ID (mid) for deduplication and status tracking */
  messageId: string;
  /** Type of message received */
  messageType: MetaMessageType;
  /** URL to media file (for image/video/audio/file messages) */
  mediaUrl?: string;
  /** MIME type of attached media */
  mediaMimeType?: string;
  /**
   * Whether this is an echo of our own sent message
   * Echo messages should be skipped to avoid processing our own responses
   */
  isEcho: boolean;
  /** Story URL if this is a story mention or reply (Instagram only) */
  storyUrl?: string;
  /** Original story message ID if this is a story reply (Instagram only) */
  replyToStoryId?: string;
  /** Postback payload if this is a button click (Messenger only) */
  postbackPayload?: string;
  /** Quick reply payload if user clicked a quick reply button */
  quickReplyPayload?: string;
  /** Referral data if user came from an ad or m.me link */
  referralData?: MetaReferral;
}

/**
 * Referral information when user comes from an ad, m.me link, or other source
 */
export interface MetaReferral {
  /** Source of the referral (e.g., "ADS", "SHORTLINK") */
  source: string;
  /** Type of referral */
  type: string;
  /** Ad ID if from an ad */
  adId?: string;
  /** Custom ref parameter from m.me link */
  ref?: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface MetaMessagingProvider {
  sendText(recipientId: string, text: string): Promise<MessageResult>;

  sendImage(
    recipientId: string,
    imageUrl: string,
    caption?: string
  ): Promise<MessageResult>;

  sendQuickReplies(
    recipientId: string,
    text: string,
    quickReplies: QuickReply[]
  ): Promise<MessageResult>;

  sendGenericTemplate(
    recipientId: string,
    elements: GenericTemplateElement[]
  ): Promise<MessageResult>;
}

// ============================================================================
// Webhook Payload Types (Raw)
// ============================================================================

/**
 * Raw webhook entry from Meta
 * Each webhook request can contain multiple entries and messaging events
 */
export interface MetaWebhookEntry {
  /** Page ID (Messenger) or Instagram Business Account ID */
  id: string;
  /** Timestamp of the webhook event */
  time: number;
  /** Array of messaging events */
  messaging?: MetaMessagingEvent[];
}

/**
 * Individual messaging event within a webhook entry
 */
export interface MetaMessagingEvent {
  /** Sender information */
  sender: { id: string };
  /** Recipient information */
  recipient: { id: string };
  /** Timestamp of the event */
  timestamp: number;
  /** Message object (if this is a message event) */
  message?: MetaRawMessage;
  /** Postback object (if this is a postback/button click event) */
  postback?: MetaRawPostback;
  /** Delivery receipt (if this is a delivery notification) */
  delivery?: MetaRawDelivery;
  /** Read receipt (if this is a read notification) */
  read?: MetaRawRead;
}

/**
 * Raw message object from webhook
 */
export interface MetaRawMessage {
  /** Meta message ID (mid) */
  mid: string;
  /** Text content of the message */
  text?: string;
  /** Attachments (images, videos, etc.) */
  attachments?: MetaRawAttachment[];
  /** Quick reply data if user clicked a quick reply */
  quick_reply?: { payload: string };
  /** Whether this is an echo of our sent message */
  is_echo?: boolean;
  /** Story mention/reply data (Instagram only) */
  reply_to?: { mid: string; story?: { url: string; id: string } };
}

/**
 * Raw attachment from webhook message
 */
export interface MetaRawAttachment {
  /** Attachment type */
  type: "image" | "video" | "audio" | "file" | "fallback" | "story_mention";
  /** Payload with URL and other data */
  payload: {
    url?: string;
    sticker_id?: number;
    title?: string;
  };
}

/**
 * Raw postback (button click) from webhook
 */
export interface MetaRawPostback {
  /** Postback title */
  title: string;
  /** Postback payload string */
  payload: string;
  /** Referral data if from an ad or link */
  referral?: {
    source: string;
    type: string;
    ad_id?: string;
    ref?: string;
  };
}

/**
 * Raw delivery receipt from webhook
 */
export interface MetaRawDelivery {
  /** Array of message IDs that were delivered */
  mids?: string[];
  /** Watermark timestamp - all messages before this were delivered */
  watermark: number;
}

/**
 * Raw read receipt from webhook
 */
export interface MetaRawRead {
  /** Watermark timestamp - all messages before this were read */
  watermark: number;
}

/**
 * Top-level webhook payload structure
 */
export interface MetaWebhookPayload {
  /** Object type: "instagram" for Instagram, "page" for Messenger */
  object: "instagram" | "page";
  /** Array of entries (one per page/account) */
  entry: MetaWebhookEntry[];
}
