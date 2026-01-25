import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import type {
  MetaChannel,
  MetaMessageType,
  MetaWebhookPayload,
  MetaWebhookEntry,
  MetaMessagingEvent,
  MetaRawMessage,
  MetaRawAttachment,
  ParsedMetaMessage,
  StatusUpdate,
} from "./types";

// ============================================================================
// Webhook Payload Parsing
// ============================================================================

/**
 * Parse a raw Meta webhook payload into normalized messages
 * Handles both Instagram (object: "instagram") and Messenger (object: "page") webhooks
 */
export function parseMetaWebhookPayload(
  payload: unknown
): ParsedMetaMessage[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = payload as MetaWebhookPayload;

  // Validate the payload has the expected structure
  if (!data.object || !Array.isArray(data.entry)) {
    return [];
  }

  const channel: MetaChannel = data.object === "instagram" ? "instagram" : "messenger";
  const messages: ParsedMetaMessage[] = [];

  for (const entry of data.entry) {
    const entryMessages = parseWebhookEntry(entry, channel);
    messages.push(...entryMessages);
  }

  return messages;
}

// ============================================================================
// Status Update Parsing (Delivery/Read Receipts)
// ============================================================================

/**
 * Result type for parsed webhook events
 * Contains either messages, status updates, or echo confirmations
 */
export interface ParsedWebhookResult {
  messages: ParsedMetaMessage[];
  statusUpdates: StatusUpdate[];
  echoConfirmations: EchoConfirmation[];
}

/**
 * Confirmation for a sent message (message_echo event)
 */
export interface EchoConfirmation {
  channel: MetaChannel;
  businessAccountId: string;
  messageId: string;
  timestamp: number;
}

/**
 * Parse a raw Meta webhook payload into all event types
 * Returns messages, status updates, and echo confirmations separately
 */
export function parseMetaWebhookPayloadFull(
  payload: unknown
): ParsedWebhookResult {
  const result: ParsedWebhookResult = {
    messages: [],
    statusUpdates: [],
    echoConfirmations: [],
  };

  if (!payload || typeof payload !== "object") {
    return result;
  }

  const data = payload as MetaWebhookPayload;

  if (!data.object || !Array.isArray(data.entry)) {
    return result;
  }

  const channel: MetaChannel = data.object === "instagram" ? "instagram" : "messenger";

  for (const entry of data.entry) {
    const entryResult = parseWebhookEntryFull(entry, channel);
    result.messages.push(...entryResult.messages);
    result.statusUpdates.push(...entryResult.statusUpdates);
    result.echoConfirmations.push(...entryResult.echoConfirmations);
  }

  return result;
}

/**
 * Parse a single webhook entry for all event types
 */
function parseWebhookEntryFull(
  entry: MetaWebhookEntry,
  channel: MetaChannel
): ParsedWebhookResult {
  const result: ParsedWebhookResult = {
    messages: [],
    statusUpdates: [],
    echoConfirmations: [],
  };

  const businessAccountId = entry.id;

  if (!entry.messaging || !Array.isArray(entry.messaging)) {
    return result;
  }

  for (const event of entry.messaging) {
    // Handle delivery receipts
    if (event.delivery) {
      const statusUpdate = parseDeliveryReceipt(event, channel, businessAccountId);
      if (statusUpdate) {
        result.statusUpdates.push(statusUpdate);
      }
      continue;
    }

    // Handle read receipts
    if (event.read) {
      const statusUpdate = parseReadReceipt(event, channel, businessAccountId);
      if (statusUpdate) {
        result.statusUpdates.push(statusUpdate);
      }
      continue;
    }

    // Handle message echoes (our sent messages coming back)
    if (event.message?.is_echo) {
      const echoConfirmation = parseMessageEcho(event, channel, businessAccountId);
      if (echoConfirmation) {
        result.echoConfirmations.push(echoConfirmation);
      }
      continue;
    }

    // Handle regular incoming messages
    const parsed = parseMessagingEvent(event, channel, businessAccountId);
    if (parsed) {
      result.messages.push(parsed);
    }
  }

  return result;
}

/**
 * Parse a delivery receipt event
 */
function parseDeliveryReceipt(
  event: MetaMessagingEvent,
  channel: MetaChannel,
  businessAccountId: string
): StatusUpdate | null {
  if (!event.delivery) {
    return null;
  }

  return {
    channel,
    businessAccountId,
    recipientId: event.sender.id,
    type: "delivery",
    messageIds: event.delivery.mids,
    watermark: event.delivery.watermark,
    timestamp: event.timestamp,
  };
}

/**
 * Parse a read receipt event
 */
function parseReadReceipt(
  event: MetaMessagingEvent,
  channel: MetaChannel,
  businessAccountId: string
): StatusUpdate | null {
  if (!event.read) {
    return null;
  }

  return {
    channel,
    businessAccountId,
    recipientId: event.sender.id,
    type: "read",
    watermark: event.read.watermark,
    timestamp: event.timestamp,
  };
}

/**
 * Parse a message echo (sent message confirmation)
 */
function parseMessageEcho(
  event: MetaMessagingEvent,
  channel: MetaChannel,
  businessAccountId: string
): EchoConfirmation | null {
  if (!event.message?.is_echo || !event.message.mid) {
    return null;
  }

  return {
    channel,
    businessAccountId,
    messageId: event.message.mid,
    timestamp: event.timestamp,
  };
}

function parseWebhookEntry(
  entry: MetaWebhookEntry,
  channel: MetaChannel
): ParsedMetaMessage[] {
  const messages: ParsedMetaMessage[] = [];
  const businessAccountId = entry.id;

  if (!entry.messaging || !Array.isArray(entry.messaging)) {
    return messages;
  }

  for (const event of entry.messaging) {
    const parsed = parseMessagingEvent(event, channel, businessAccountId);
    if (parsed) {
      messages.push(parsed);
    }
  }

  return messages;
}

function parseMessagingEvent(
  event: MetaMessagingEvent,
  channel: MetaChannel,
  businessAccountId: string
): ParsedMetaMessage | null {
  const senderId = event.sender.id;
  const timestamp = event.timestamp;

  if (event.postback) {
    const postback = event.postback;
    const parsed: ParsedMetaMessage = {
      channel,
      businessAccountId,
      senderId,
      content: postback.title,
      timestamp,
      messageId: `postback_${businessAccountId}_${senderId}_${timestamp}`,
      messageType: "text",
      isEcho: false,
      postbackPayload: postback.payload,
    };

    if (postback.referral) {
      parsed.referralData = {
        source: postback.referral.source,
        type: postback.referral.type,
        adId: postback.referral.ad_id,
        ref: postback.referral.ref,
      };
    }

    return parsed;
  }

  if (!event.message) {
    return null;
  }

  const message = event.message;

  if (message.is_echo) {
    return null;
  }

  const messageId = message.mid;
  const { messageType, content, mediaUrl, mediaMimeType } = extractMessageContent(message, channel);

  const parsed: ParsedMetaMessage = {
    channel,
    businessAccountId,
    senderId,
    content,
    timestamp,
    messageId,
    messageType,
    isEcho: false,
    mediaUrl,
    mediaMimeType,
  };

  if (message.quick_reply) {
    parsed.quickReplyPayload = message.quick_reply.payload;
  }

  if (message.reply_to?.story) {
    parsed.replyToStoryId = message.reply_to.mid;
    parsed.storyUrl = message.reply_to.story.url;
    if (parsed.messageType === "text") {
      parsed.messageType = "story_reply";
    }
  }

  return parsed;
}

function extractMessageContent(
  message: MetaRawMessage,
  channel: MetaChannel
): {
  messageType: MetaMessageType;
  content: string;
  mediaUrl?: string;
  mediaMimeType?: string;
} {
  if (message.text && !message.attachments?.length) {
    return {
      messageType: "text",
      content: message.text,
    };
  }

  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    return extractAttachmentContent(attachment, message.text ?? "", channel);
  }

  return {
    messageType: "text",
    content: message.text ?? "",
  };
}

function extractAttachmentContent(
  attachment: MetaRawAttachment,
  fallbackText: string,
  _channel: MetaChannel
): {
  messageType: MetaMessageType;
  content: string;
  mediaUrl?: string;
  mediaMimeType?: string;
} {
  const attachmentType = attachment.type;
  const mediaUrl = attachment.payload?.url;

  switch (attachmentType) {
    case "image":
      return {
        messageType: "image",
        content: fallbackText || "[Image]",
        mediaUrl,
        mediaMimeType: "image/*",
      };
    case "video":
      return {
        messageType: "video",
        content: fallbackText || "[Video]",
        mediaUrl,
        mediaMimeType: "video/*",
      };
    case "audio":
      return {
        messageType: "audio",
        content: fallbackText || "[Audio]",
        mediaUrl,
        mediaMimeType: "audio/*",
      };
    case "file":
      return {
        messageType: "file",
        content: fallbackText || "[File]",
        mediaUrl,
        mediaMimeType: "application/octet-stream",
      };
    case "story_mention":
      return {
        messageType: "story_mention",
        content: fallbackText || "[Story Mention]",
        mediaUrl,
      };
    case "fallback":
      if (attachment.payload?.sticker_id) {
        return {
          messageType: "sticker",
          content: fallbackText || "[Sticker]",
        };
      }
      return {
        messageType: "text",
        content: fallbackText || attachment.payload?.title || "[Attachment]",
      };
    default:
      return {
        messageType: "text",
        content: fallbackText || "[Attachment]",
      };
  }
}

// ============================================================================
// Database Queries and Mutations
// ============================================================================

/**
 * Look up business by Instagram Account ID
 */
export const getBusinessByInstagramId = internalQuery({
  args: {
    instagramAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_instagram", (q) => q.eq("instagramAccountId", args.instagramAccountId))
      .first();

    if (!connection) {
      return null;
    }

    const business = await ctx.db.get(connection.businessId);
    if (!business) {
      return null;
    }

    return {
      businessId: business._id,
      pageAccessToken: connection.pageAccessToken,
      pageId: connection.pageId,
      instagramAccountId: connection.instagramAccountId,
    };
  },
});

/**
 * Look up business by Facebook Page ID
 */
export const getBusinessByPageId = internalQuery({
  args: {
    pageId: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .first();

    if (!connection) {
      return null;
    }

    const business = await ctx.db.get(connection.businessId);
    if (!business) {
      return null;
    }

    return {
      businessId: business._id,
      pageAccessToken: connection.pageAccessToken,
      pageId: connection.pageId,
      instagramAccountId: connection.instagramAccountId,
    };
  },
});

/**
 * Process an incoming Instagram or Messenger message
 * Creates/finds conversation, stores message, and returns context for AI processing
 */
export const processIncomingMessage = internalMutation({
  args: {
    businessId: v.id("businesses"),
    channel: v.union(v.literal("instagram"), v.literal("messenger")),
    senderId: v.string(),
    content: v.string(),
    messageType: v.string(),
    messageId: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    timestamp: v.number(),
    // For Meta, businessAccountId is either Instagram Account ID or Page ID
    businessAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const {
      businessId,
      channel,
      senderId,
      content,
      messageType,
      messageId,
      mediaUrl,
      mediaType,
      timestamp,
      businessAccountId,
    } = args;

    // channelId format: {channel}:{senderId}:{businessAccountId}
    // Unique per sender-business pair on each channel
    const channelId = `${channel}:${senderId}:${businessAccountId}`;

    // Check for existing conversation
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_channel", (q) =>
        q.eq("channelId", channelId).eq("businessId", businessId)
      )
      .first();

    let conversationId: Id<"conversations">;
    const now = Date.now();

    // Get or create customer record using senderId as phone placeholder
    // For Meta, senderId is IGSID/PSID, not a phone number
    const customerRecordId = await ctx.runMutation(
      internal.customers.getOrCreate,
      { businessId, phone: `${channel}:${senderId}` }
    );

    if (existingConversation) {
      conversationId = existingConversation._id;

      // Reopen if closed and new message comes in
      const updates: Record<string, unknown> = {
        lastCustomerMessageAt: timestamp,
        customerRecordId,
        updatedAt: now,
      };

      if (existingConversation.status === "closed") {
        updates.status = "active";
        updates.closedAt = undefined;
      }

      await ctx.db.patch(conversationId, updates);
    } else {
      conversationId = await ctx.db.insert("conversations", {
        businessId,
        customerId: senderId,
        customerRecordId,
        channel,
        channelId,
        lastCustomerMessageAt: timestamp,
        status: "active",
        state: "idle",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Check for duplicate message (by externalId)
    const existingMessage = await ctx.db
      .query("messages")
      .withIndex("by_external_id", (q) => q.eq("externalId", messageId))
      .first();

    if (existingMessage) {
      // Message already processed (webhook retry)
      return {
        conversationId,
        messageId: existingMessage._id,
        isNewConversation: false,
        isDuplicate: true,
      };
    }

    // Store the message
    const storedMessageId = await ctx.db.insert("messages", {
      conversationId,
      sender: "customer",
      content,
      messageType,
      externalId: messageId,
      deliveryStatus: "received",
      mediaUrl,
      mediaType,
      createdAt: timestamp,
    });

    // Update lastMessageAt on metaConnections
    const connection = channel === "instagram"
      ? await ctx.db
          .query("metaConnections")
          .withIndex("by_instagram", (q) => q.eq("instagramAccountId", businessAccountId))
          .first()
      : await ctx.db
          .query("metaConnections")
          .withIndex("by_page", (q) => q.eq("pageId", businessAccountId))
          .first();

    if (connection) {
      await ctx.db.patch(connection._id, {
        lastMessageAt: now,
        updatedAt: now,
      });
    }

    return {
      conversationId,
      messageId: storedMessageId,
      isNewConversation: !existingConversation,
      isDuplicate: false,
    };
  },
});

/**
 * Update message delivery status from webhook delivery/read receipts
 */
export const updateMessageStatus = internalMutation({
  args: {
    externalId: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const { externalId, status } = args;

    const message = await ctx.db
      .query("messages")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .first();

    if (!message) {
      console.log(`Meta webhook: Message not found for externalId: ${externalId}`);
      return { updated: false, reason: "message_not_found" };
    }

    await ctx.db.patch(message._id, {
      deliveryStatus: status,
    });

    return { updated: true, messageId: message._id };
  },
});
