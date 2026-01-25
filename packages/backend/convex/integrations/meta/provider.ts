/**
 * Meta Messaging Provider Implementation
 *
 * Implements the MetaMessagingProvider interface for sending messages via
 * the Meta Graph API (Instagram DM and Facebook Messenger).
 *
 * @see https://developers.facebook.com/docs/messenger-platform/send-messages
 * @see https://developers.facebook.com/docs/instagram-api/guides/messaging
 */

import type {
  MetaChannel,
  MetaMessagingProvider,
  MessageResult,
  QuickReply,
  GenericTemplateElement,
  MetaMessagingType,
  MetaMessageTag,
} from "./types";

/** Meta Graph API base URL */
const GRAPH_API_BASE_URL = "https://graph.facebook.com/v19.0";

/** Maximum quick replies allowed by Messenger */
const MAX_QUICK_REPLIES = 13;

/**
 * Response from Meta Graph API when sending a message
 */
interface MetaSendResponse {
  recipient_id?: string;
  message_id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Meta Messaging Provider Implementation
 *
 * Provides methods to send messages via the Meta Graph API.
 * Supports both Instagram DM and Facebook Messenger channels.
 *
 * Note: Instagram has stricter limitations than Messenger:
 * - No quick replies (will fallback to text)
 * - No rich templates
 * - 24-hour messaging window strictly enforced
 */
export interface MessagingOptions {
  messagingType?: MetaMessagingType;
  messageTag?: MetaMessageTag;
}

export class MetaMessagingProviderImpl implements MetaMessagingProvider {
  private readonly pageAccessToken: string;
  private readonly pageOrIgId: string;
  private readonly channel: MetaChannel;
  private messagingType: MetaMessagingType = "RESPONSE";
  private messageTag?: MetaMessageTag;

  /**
   * Creates a new Meta Messaging Provider instance
   *
   * @param pageAccessToken - Long-lived page access token from OAuth
   * @param pageOrIgId - Facebook Page ID (for Messenger) or Instagram Business Account ID (for Instagram)
   * @param channel - The channel to send messages on ('instagram' or 'messenger')
   * @param options - Optional messaging configuration (messagingType, messageTag)
   */
  constructor(
    pageAccessToken: string,
    pageOrIgId: string,
    channel: MetaChannel,
    options?: MessagingOptions
  ) {
    if (!pageAccessToken) {
      throw new Error("pageAccessToken is required");
    }
    if (!pageOrIgId) {
      throw new Error("pageOrIgId is required");
    }
    this.pageAccessToken = pageAccessToken;
    this.pageOrIgId = pageOrIgId;
    this.channel = channel;
    if (options?.messagingType) {
      this.messagingType = options.messagingType;
    }
    if (options?.messageTag) {
      this.messageTag = options.messageTag;
    }
  }

  private buildRequestBody(recipientId: string, message: object): object {
    const body: Record<string, unknown> = {
      recipient: { id: recipientId },
      messaging_type: this.messagingType,
      message,
    };

    if (this.messagingType === "MESSAGE_TAG" && this.messageTag) {
      body.tag = this.messageTag;
    }

    return body;
  }

  /**
   * Send a plain text message
   *
   * @param recipientId - PSID (Messenger) or IGSID (Instagram)
   * @param text - Message text content (max 2000 characters)
   */
  async sendText(recipientId: string, text: string): Promise<MessageResult> {
    const requestBody = this.buildRequestBody(recipientId, { text });
    return this.sendRequest(requestBody);
  }

  /**
   * Send an image message with optional caption
   *
   * @param recipientId - PSID (Messenger) or IGSID (Instagram)
   * @param imageUrl - Public URL to the image (must be HTTPS)
   * @param caption - Optional text caption (Instagram only sends separately for Messenger)
   */
  async sendImage(
    recipientId: string,
    imageUrl: string,
    caption?: string
  ): Promise<MessageResult> {
    const requestBody = this.buildRequestBody(recipientId, {
      attachment: {
        type: "image",
        payload: {
          url: imageUrl,
          is_reusable: false,
        },
      },
    });

    const result = await this.sendRequest(requestBody);

    if (result.success && caption) {
      await this.sendText(recipientId, caption);
    }

    return result;
  }

  /**
   * Send a message with quick reply buttons
   *
   * Instagram does not support quick replies - will fallback to numbered text
   *
   * @param recipientId - PSID (Messenger) or IGSID (Instagram)
   * @param text - Message text to accompany the quick replies
   * @param quickReplies - Array of quick reply buttons (max 13 for Messenger)
   */
  async sendQuickReplies(
    recipientId: string,
    text: string,
    quickReplies: QuickReply[]
  ): Promise<MessageResult> {
    // Instagram does not support quick replies - fallback to numbered text
    if (this.channel === "instagram") {
      console.log(
        "[MetaProvider] Quick replies not supported on Instagram, falling back to text"
      );
      const numberedOptions = quickReplies
        .map((qr, idx) => `${idx + 1}. ${qr.title}`)
        .join("\n");
      const fallbackText = `${text}\n\n${numberedOptions}\n\nReply with the number of your choice.`;
      return this.sendText(recipientId, fallbackText);
    }

    // Messenger: use native quick replies (max 13)
    const truncatedReplies = quickReplies.slice(0, MAX_QUICK_REPLIES);

    if (quickReplies.length > MAX_QUICK_REPLIES) {
      console.log(
        `[MetaProvider] Truncating quick replies from ${quickReplies.length} to ${MAX_QUICK_REPLIES}`
      );
    }

    const requestBody = this.buildRequestBody(recipientId, {
      text,
      quick_replies: truncatedReplies.map((qr) => ({
        content_type: qr.content_type,
        title: qr.title.slice(0, 20),
        payload: qr.payload.slice(0, 1000),
        ...(qr.image_url && { image_url: qr.image_url }),
      })),
    });

    return this.sendRequest(requestBody);
  }

  async sendGenericTemplate(
    recipientId: string,
    elements: GenericTemplateElement[]
  ): Promise<MessageResult> {
    // Instagram does not support generic templates - fallback to text list
    if (this.channel === "instagram") {
      console.log(
        "[MetaProvider] Generic templates not supported on Instagram, falling back to text"
      );
      const textFallback = elements
        .map((el, idx) => {
          let text = `${idx + 1}. ${el.title}`;
          if (el.subtitle) {
            text += `\n   ${el.subtitle}`;
          }
          if (el.default_action?.url) {
            text += `\n   ${el.default_action.url}`;
          }
          return text;
        })
        .join("\n\n");
      return this.sendText(recipientId, textFallback);
    }

    // Messenger: max 10 elements in generic template
    const MAX_ELEMENTS = 10;
    const truncatedElements = elements.slice(0, MAX_ELEMENTS);

    if (elements.length > MAX_ELEMENTS) {
      console.log(
        `[MetaProvider] Truncating generic template from ${elements.length} to ${MAX_ELEMENTS} elements`
      );
    }

    const requestBody = this.buildRequestBody(recipientId, {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: truncatedElements.map((el) => ({
            title: el.title.slice(0, 80),
            subtitle: el.subtitle?.slice(0, 80),
            image_url: el.image_url,
            default_action: el.default_action,
            buttons: el.buttons?.slice(0, 3).map((btn) => ({
              type: btn.type,
              title: btn.title.slice(0, 20),
              ...(btn.url && { url: btn.url }),
              ...(btn.payload && { payload: btn.payload }),
            })),
          })),
        },
      },
    });

    return this.sendRequest(requestBody);
  }

  private async sendRequest(requestBody: object): Promise<MessageResult> {
    const url = `${GRAPH_API_BASE_URL}/${this.pageOrIgId}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.pageAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = (await response.json()) as MetaSendResponse;

      if (!response.ok || result.error) {
        const error = result.error;
        console.error("[MetaProvider] API error:", {
          status: response.status,
          error: result.error,
        });

        return {
          success: false,
          error: error?.message || `HTTP ${response.status}`,
          errorCode: error?.code,
          errorSubcode: error?.error_subcode,
        };
      }

      return {
        success: true,
        messageId: result.message_id,
      };
    } catch (error) {
      console.error("[MetaProvider] Request failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
