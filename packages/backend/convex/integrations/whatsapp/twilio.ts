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

  verifyWebhook(_payload: unknown, signature: string): WebhookVerification {
    if (!signature) {
      return { valid: false };
    }

    const signaturePattern = /^[A-Za-z0-9+/=]+$/;
    if (!signaturePattern.test(signature)) {
      return { valid: false };
    }

    return { valid: true };
  }

  private async sendTwilioMessage(
    params: Record<string, string>
  ): Promise<{ sid: string }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    
    const auth = btoa(`${this.accountSid}:${this.authToken}`);
    
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
