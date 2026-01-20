import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { TwilioWhatsAppProvider } from "./integrations/whatsapp/twilio";
import type { MessageType } from "./integrations/whatsapp/types";

import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/webhook/whatsapp",
  method: "GET",
  handler: httpAction(async (_, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }),
});

http.route({
  path: "/webhook/whatsapp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: unknown;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      payload = Object.fromEntries(params.entries());
    } else {
      payload = await request.json();
    }

    if (TwilioWhatsAppProvider.isStatusUpdate(payload)) {
      return await handleStatusUpdate(ctx, payload);
    }

    return await handleIncomingMessage(ctx, payload);
  }),
});

async function handleStatusUpdate(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  payload: unknown
): Promise<Response> {
  const dummyProvider = new TwilioWhatsAppProvider(
    { accountSid: "", authToken: "" },
    ""
  );
  const statusUpdate = dummyProvider.parseStatusUpdate(payload);

  if (!statusUpdate) {
    return new Response("OK", { status: 200 });
  }

  await ctx.runMutation(
    internal.integrations.whatsapp.webhook.updateMessageStatus,
    {
      externalId: statusUpdate.externalId,
      status: statusUpdate.status,
      errorCode: statusUpdate.errorCode,
      errorMessage: statusUpdate.errorMessage,
    }
  );

  return new Response("OK", { status: 200 });
}

async function handleIncomingMessage(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
  payload: unknown
): Promise<Response> {
  const toPhoneNumber = extractToPhoneNumber(payload);
  if (!toPhoneNumber) {
    return new Response("OK", { status: 200 });
  }

  const businessLookup = await ctx.runMutation(
    internal.integrations.whatsapp.webhook.getBusinessByPhoneNumber,
    { phoneNumber: toPhoneNumber }
  );

  if (!businessLookup) {
    console.log(`No business found for phone number: ${toPhoneNumber}`);
    return new Response("OK", { status: 200 });
  }

  const provider = new TwilioWhatsAppProvider(
    businessLookup.credentials,
    toPhoneNumber
  );

  const parsedMessage = provider.parseWebhook(payload);

  if (!parsedMessage) {
    return new Response("OK", { status: 200 });
  }

  const validMessageTypes: MessageType[] = ["text", "image", "voice", "document"];
  const messageType = validMessageTypes.includes(parsedMessage.messageType)
    ? parsedMessage.messageType
    : "text";

  const messageResult = await ctx.runMutation(
    internal.integrations.whatsapp.webhook.processIncomingMessage,
    {
      businessId: businessLookup.businessId,
      customerPhone: parsedMessage.from,
      content: parsedMessage.content,
      messageType: messageType as "text" | "image" | "voice" | "document",
      externalId: parsedMessage.externalId,
      mediaUrl: parsedMessage.mediaUrl,
      mediaType: parsedMessage.mediaType,
      timestamp: parsedMessage.timestamp,
    }
  );

  if (messageType === "text" && parsedMessage.content.trim()) {
    try {
      const aiResult = await ctx.runAction(api.ai.process.processMessage, {
        conversationId: messageResult.conversationId,
        message: parsedMessage.content,
      });

      await ctx.runAction(api.integrations.whatsapp.actions.sendMessage, {
        conversationId: messageResult.conversationId,
        content: aiResult.response,
        type: "text",
      });
    } catch (error) {
      console.error("AI processing or reply failed:", error);
    }
  }

  return new Response("OK", { status: 200 });
}

function extractToPhoneNumber(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as Record<string, unknown>;

  if (typeof data.To === "string") {
    return data.To.replace("whatsapp:", "");
  }

  return null;
}

export default http;
