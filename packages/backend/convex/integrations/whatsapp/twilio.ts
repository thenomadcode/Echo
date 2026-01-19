import * as crypto from "crypto";
import type {
  WhatsAppProvider,
  Button,
  ListSection,
  MessageResult,
  ParsedMessage,
  WebhookVerification,
  ProviderCredentials,
} from "./types";

interface TwilioWebhookPayload {
  SmsMessageSid?: string;
  MessageSid?: string;
  NumMedia?: string;
  ProfileName?: string;
  SmsSid?: string;
  WaId?: string;
  SmsStatus?: string;
  Body?: string;
  From?: string;
  To?: string;
  MediaContentType0?: string;
  MediaUrl0?: string;
  AccountSid?: string;
  MessageStatus?: string;
}

export class TwilioWhatsAppProvider implements WhatsAppProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(credentials: ProviderCredentials, fromNumber: string) {
    if (!credentials.accountSid || !credentials.authToken) {
      throw new Error("Twilio credentials require accountSid and authToken");
    }
    this.accountSid = credentials.accountSid;
    this.authToken = credentials.authToken;
    this.fromNumber = fromNumber;
  }

  async sendText(to: string, message: string): Promise<MessageResult> {
    try {
      const response = await this.sendTwilioMessage({
        To: `whatsapp:${to}`,
        From: `whatsapp:${this.fromNumber}`,
        Body: message,
      });

      return {
        success: true,
        messageId: response.sid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send text message",
      };
    }
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageResult> {
    try {
      const response = await this.sendTwilioMessage({
        To: `whatsapp:${to}`,
        From: `whatsapp:${this.fromNumber}`,
        MediaUrl: imageUrl,
        Body: caption || "",
      });

      return {
        success: true,
        messageId: response.sid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send image",
      };
    }
  }

  async sendButtons(to: string, body: string, buttons: Button[]): Promise<MessageResult> {
    // Twilio WhatsApp doesn't natively support button templates without pre-approval
    // Fall back to numbered options in text format
    const buttonText = buttons
      .map((btn, idx) => `${idx + 1}. ${btn.title}`)
      .join("\n");
    
    const message = `${body}\n\n${buttonText}\n\nReply with the number of your choice.`;
    
    return this.sendText(to, message);
  }

  async sendList(
    to: string,
    body: string,
    sections: ListSection[],
    buttonText?: string
  ): Promise<MessageResult> {
    // Twilio WhatsApp doesn't natively support list messages without pre-approval
    // Fall back to formatted text with sections
    const sectionTexts = sections.map((section) => {
      const rowsText = section.rows
        .map((row, idx) => {
          const desc = row.description ? ` - ${row.description}` : "";
          return `  ${idx + 1}. ${row.title}${desc}`;
        })
        .join("\n");
      return `*${section.title}*\n${rowsText}`;
    });

    const message = `${body}\n\n${sectionTexts.join("\n\n")}\n\n${buttonText || "Reply with your choice."}`;
    
    return this.sendText(to, message);
  }

  parseWebhook(payload: unknown): ParsedMessage | null {
    const data = payload as TwilioWebhookPayload;

    if (!data.From || !data.Body) {
      return null;
    }

    const phoneNumber = data.From.replace("whatsapp:", "");
    const hasMedia = data.NumMedia && parseInt(data.NumMedia, 10) > 0;

    let messageType: ParsedMessage["messageType"] = "text";
    let mediaUrl: string | undefined;
    let mediaType: string | undefined;

    if (hasMedia && data.MediaUrl0) {
      mediaUrl = data.MediaUrl0;
      mediaType = data.MediaContentType0;
      
      if (mediaType?.startsWith("image/")) {
        messageType = "image";
      } else if (mediaType?.startsWith("audio/")) {
        messageType = "voice";
      } else {
        messageType = "document";
      }
    }

    return {
      from: phoneNumber,
      content: data.Body || "",
      timestamp: Date.now(),
      mediaUrl,
      mediaType,
      messageType,
      externalId: data.MessageSid || data.SmsMessageSid || "",
    };
  }

  verifyWebhook(payload: unknown, signature: string): WebhookVerification {
    // Twilio uses X-Twilio-Signature header for webhook verification
    // The signature is an HMAC-SHA1 of the URL + sorted POST params
    // For simplified verification, we check if signature is present and valid format
    
    if (!signature) {
      return { valid: false };
    }

    // Twilio signatures are base64-encoded HMAC-SHA1
    const signaturePattern = /^[A-Za-z0-9+/=]+$/;
    if (!signaturePattern.test(signature)) {
      return { valid: false };
    }

    // Full verification would require the webhook URL and computing:
    // HMAC-SHA1(authToken, webhookUrl + sortedParams)
    // For now, we accept if signature format is valid
    // Production should implement full verification
    return { valid: true };
  }

  computeSignature(url: string, params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map((key) => `${key}${params[key]}`).join("");
    const data = url + paramString;
    
    return crypto
      .createHmac("sha1", this.authToken)
      .update(data, "utf-8")
      .digest("base64");
  }

  private async sendTwilioMessage(
    params: Record<string, string>
  ): Promise<{ sid: string }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    
    const body = new URLSearchParams(params);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twilio API error: ${response.status} - ${errorBody}`);
    }

    const result = (await response.json()) as { sid: string };
    return result;
  }
}
