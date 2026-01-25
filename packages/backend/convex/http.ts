import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { TwilioWhatsAppProvider } from "./integrations/whatsapp/twilio";
import type { MessageType } from "./integrations/whatsapp/types";
import { verifyMetaSignature } from "./integrations/meta/security";
import { parseMetaWebhookPayloadFull } from "./integrations/meta/webhook";

import { authComponent, createAuth } from "./auth";
import type { Id } from "./_generated/dataModel";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/shopify/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const shop = url.searchParams.get("shop");
    const state = url.searchParams.get("state");

    const frontendUrl = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "";
    const redirectBase = `${frontendUrl}/settings/integrations/shopify`;

    if (!code || !shop || !state) {
      return Response.redirect(`${redirectBase}?error=missing_params`, 302);
    }

    try {
      const result = await ctx.runAction(api.shopify.handleCallback, {
        code,
        shop,
        state,
      });

      if (result.success) {
        return Response.redirect(`${redirectBase}?connected=true`, 302);
      }

      const errorParam = encodeURIComponent(result.error ?? "auth_failed");
      return Response.redirect(`${redirectBase}?error=${errorParam}`, 302);
    } catch (error) {
      console.error("Shopify OAuth callback error:", error);
      return Response.redirect(`${redirectBase}?error=auth_failed`, 302);
    }
  }),
});

// ============================================================================
// Meta (Instagram/Messenger) OAuth Callback
// ============================================================================

http.route({
  path: "/meta/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason");
    const errorDescription = url.searchParams.get("error_description");

    const frontendUrl = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "";
    const redirectBase = `${frontendUrl}/settings/integrations/meta`;

    // Handle OAuth denial/error from Facebook
    if (error) {
      console.error("Meta OAuth error:", { error, errorReason, errorDescription });
      const errorParam = encodeURIComponent(errorDescription ?? errorReason ?? error);
      return Response.redirect(`${redirectBase}?error=${errorParam}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${redirectBase}?error=missing_params`, 302);
    }

    // State format: {randomState}|{businessId}
    const stateParts = state.split("|");
    if (stateParts.length !== 2) {
      return Response.redirect(`${redirectBase}?error=invalid_state`, 302);
    }

    const [, businessIdStr] = stateParts;
    const businessId = businessIdStr as Id<"businesses">;

    try {
      const result = await ctx.runAction(
        internal.integrations.meta.actions.handleOAuthCallback,
        {
          code,
          businessId,
        }
      );

      if (result.success) {
        return Response.redirect(`${redirectBase}?connected=true`, 302);
      }

      const errorParam = encodeURIComponent(result.error ?? "auth_failed");
      return Response.redirect(`${redirectBase}?error=${errorParam}`, 302);
    } catch (err) {
      console.error("Meta OAuth callback error:", err);
      return Response.redirect(`${redirectBase}?error=auth_failed`, 302);
    }
  }),
});

// ============================================================================
// Meta (Instagram/Messenger) Webhooks
// ============================================================================

/**
 * Webhook verification endpoint for Meta (Instagram DM / Facebook Messenger)
 *
 * Meta sends a GET request to verify the webhook URL during setup.
 * We must verify the token and return the challenge value.
 *
 * @see https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 */
http.route({
  path: "/webhook/meta",
  method: "GET",
  handler: httpAction(async (_, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

    console.log("Meta webhook verification attempt:", {
      mode,
      hasToken: !!token,
      hasChallenge: !!challenge,
      tokenConfigured: !!verifyToken,
    });

    if (mode === "subscribe" && token && token === verifyToken) {
      console.log("Meta webhook verification successful");
      return new Response(challenge ?? "", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.error("Meta webhook verification failed:", {
      modeValid: mode === "subscribe",
      tokenMatch: token === verifyToken,
    });
    return new Response("Forbidden", { status: 403 });
  }),
});

http.route({
  path: "/webhook/meta",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error("META_APP_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const signature = request.headers.get("X-Hub-Signature-256");
    if (!signature) {
      console.error("Missing X-Hub-Signature-256 header");
      return new Response("Missing signature", { status: 400 });
    }

    const body = await request.text();

    const isValid = verifyMetaSignature(body, signature, appSecret);
    if (!isValid) {
      console.error("Invalid Meta webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      console.error("Failed to parse Meta webhook body");
      return new Response("Invalid JSON", { status: 400 });
    }

    const data = payload as { object?: string };
    const objectType = data.object === "page" ? "messenger" : data.object;
    console.log(`Meta webhook received: object=${data.object} (${objectType})`);

    const parsed = parseMetaWebhookPayloadFull(payload);

    for (const statusUpdate of parsed.statusUpdates) {
      const status = statusUpdate.type === "delivery" ? "delivered" : "read";
      
      if (statusUpdate.messageIds && statusUpdate.messageIds.length > 0) {
        for (const mid of statusUpdate.messageIds) {
          await ctx.runMutation(
            internal.integrations.meta.webhook.updateMessageStatus,
            { externalId: mid, status }
          );
        }
        console.log(
          `Meta ${statusUpdate.channel}: Updated ${statusUpdate.messageIds.length} messages to ${status}`
        );
      }
    }

    for (const echo of parsed.echoConfirmations) {
      await ctx.runMutation(
        internal.integrations.meta.webhook.updateMessageStatus,
        { externalId: echo.messageId, status: "sent" }
      );
      console.log(`Meta ${echo.channel}: Confirmed sent message ${echo.messageId}`);
    }

    if (parsed.messages.length === 0) {
      return new Response("OK", { status: 200 });
    }

    for (const message of parsed.messages) {
      let businessLookup;

      if (message.channel === "instagram") {
        businessLookup = await ctx.runQuery(
          internal.integrations.meta.webhook.getBusinessByInstagramId,
          { instagramAccountId: message.businessAccountId }
        );
      } else {
        businessLookup = await ctx.runQuery(
          internal.integrations.meta.webhook.getBusinessByPageId,
          { pageId: message.businessAccountId }
        );
      }

      if (!businessLookup) {
        console.log(
          `No business found for ${message.channel} account: ${message.businessAccountId}`
        );
        continue;
      }

      const messageResult = await ctx.runMutation(
        internal.integrations.meta.webhook.processIncomingMessage,
        {
          businessId: businessLookup.businessId,
          channel: message.channel,
          senderId: message.senderId,
          content: message.content,
          messageType: message.messageType,
          messageId: message.messageId,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaMimeType,
          timestamp: message.timestamp,
          businessAccountId: message.businessAccountId,
        }
      );

      if (messageResult.isDuplicate) {
        console.log(`Skipping duplicate message: ${message.messageId}`);
        continue;
      }

      if (message.messageType === "text" && message.content.trim()) {
        try {
          const aiResult = await ctx.runAction(api.ai.process.processMessage, {
            conversationId: messageResult.conversationId,
            message: message.content,
          });

          await ctx.runMutation(internal.ai.process.storeMessage, {
            conversationId: messageResult.conversationId,
            content: aiResult.response,
            sender: "assistant",
          });

          console.log(
            `Meta ${message.channel}: AI response stored for conversation ${messageResult.conversationId}`
          );
        } catch (error) {
          console.error("AI processing failed:", error);
        }
      }
    }

    return new Response("OK", { status: 200 });
  }),
});

// ============================================================================
// WhatsApp Webhooks
// ============================================================================

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

http.route({
  path: "/webhook/shopify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const shopifySecret = process.env.SHOPIFY_API_SECRET;
    if (!shopifySecret) {
      console.error("SHOPIFY_API_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const shop = request.headers.get("X-Shopify-Shop-Domain");
    const topic = request.headers.get("X-Shopify-Topic");
    const hmacHeader = request.headers.get("X-Shopify-Hmac-SHA256");

    if (!shop || !topic || !hmacHeader) {
      console.error("Missing required Shopify headers", { shop, topic, hmacHeader: !!hmacHeader });
      return new Response("Missing required headers", { status: 400 });
    }

    const body = await request.text();

    const isValid = verifyShopifySignature(body, hmacHeader, shopifySecret);
    if (!isValid) {
      console.error("Invalid Shopify webhook signature");
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      console.error("Failed to parse Shopify webhook body");
      return new Response("Invalid JSON", { status: 400 });
    }

    console.log(`Shopify webhook received: ${topic} from ${shop}`);

    ctx.runAction(internal.shopify.handleWebhook, {
      topic,
      shop,
      data: payload as Record<string, unknown>,
    }).catch((error) => {
      console.error(`Error processing Shopify webhook ${topic}:`, error);
    });

    return new Response("OK", { status: 200 });
  }),
});

http.route({
  path: "/webhook/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeWebhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      console.error("Missing stripe-signature header");
      return new Response("Missing signature", { status: 400 });
    }

    const body = await request.text();

    const isValid = verifyStripeSignature(body, signature, stripeWebhookSecret);
    if (!isValid) {
      console.error("Invalid Stripe webhook signature");
      return new Response("Invalid signature", { status: 400 });
    }

    let event: StripeEvent;
    try {
      event = JSON.parse(body) as StripeEvent;
    } catch {
      console.error("Failed to parse webhook body");
      return new Response("Invalid JSON", { status: 400 });
    }

    console.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as StripeCheckoutSession;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await ctx.runMutation(internal.orders.updateOrderPaymentStatus, {
            stripeSessionId: session.id,
            status: "paid",
            paymentStatus: "paid",
          });
          console.log(`Order ${orderId} marked as paid`);
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as StripeCheckoutSession;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          await ctx.runMutation(internal.orders.updateOrderPaymentStatus, {
            stripeSessionId: session.id,
            paymentStatus: "failed",
          });
          console.log(`Order ${orderId} payment link expired`);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as { metadata?: { orderId?: string }; id?: string };
        console.log(`Payment failed for intent: ${paymentIntent.id}`);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response("OK", { status: 200 });
  }),
});

type StripeEvent = {
  type: string;
  data: {
    object: unknown;
  };
};

type StripeCheckoutSession = {
  id: string;
  metadata?: {
    orderId?: string;
  };
};

function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const parts = signature.split(",");
  let timestamp: string | undefined;
  let v1Signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signature = value;
  }

  if (!timestamp || !v1Signature) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(signedPayload);

  return computeHmacSha256Sync(keyData, messageData, v1Signature);
}

function computeHmacSha256Sync(
  keyData: Uint8Array,
  messageData: Uint8Array,
  expectedHex: string
): boolean {
  const keyLength = keyData.length;
  const blockSize = 64;

  let key = keyData;
  if (keyLength > blockSize) {
    key = sha256(keyData);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(key);

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  const innerData = new Uint8Array(blockSize + messageData.length);
  innerData.set(ipad);
  innerData.set(messageData, blockSize);
  const innerHash = sha256(innerData);

  const outerData = new Uint8Array(blockSize + 32);
  outerData.set(opad);
  outerData.set(innerHash, blockSize);
  const hmac = sha256(outerData);

  const computedHex = Array.from(hmac)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedHex === expectedHex;
}

function verifyShopifySignature(
  payload: string,
  expectedBase64: string,
  secret: string
): boolean {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const computedHmac = computeHmacSha256Raw(keyData, messageData);
  const computedBase64 = uint8ArrayToBase64(computedHmac);

  return computedBase64 === expectedBase64;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function computeHmacSha256Raw(
  keyData: Uint8Array,
  messageData: Uint8Array
): Uint8Array {
  const blockSize = 64;

  let key = keyData;
  if (keyData.length > blockSize) {
    key = sha256(keyData);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(key);

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  const innerData = new Uint8Array(blockSize + messageData.length);
  innerData.set(ipad);
  innerData.set(messageData, blockSize);
  const innerHash = sha256(innerData);

  const outerData = new Uint8Array(blockSize + 32);
  outerData.set(opad);
  outerData.set(innerHash, blockSize);

  return sha256(outerData);
}

function sha256(data: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  let H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);

  const msgLen = data.length;
  const bitLen = msgLen * 8;
  const padLen = (msgLen + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[msgLen] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen, false);

  const W = new Uint32Array(64);

  for (let i = 0; i < padLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      W[j] = view.getUint32(i + j * 4, false);
    }
    for (let j = 16; j < 64; j++) {
      const s0 =
        ((W[j - 15] >>> 7) | (W[j - 15] << 25)) ^
        ((W[j - 15] >>> 18) | (W[j - 15] << 14)) ^
        (W[j - 15] >>> 3);
      const s1 =
        ((W[j - 2] >>> 17) | (W[j - 2] << 15)) ^
        ((W[j - 2] >>> 19) | (W[j - 2] << 13)) ^
        (W[j - 2] >>> 10);
      W[j] = (W[j - 16] + s0 + W[j - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let j = 0; j < 64; j++) {
      const S1 =
        ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + W[j]) >>> 0;
      const S0 =
        ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const resultView = new DataView(result.buffer);
  for (let i = 0; i < 8; i++) {
    resultView.setUint32(i * 4, H[i], false);
  }
  return result;
}

export default http;
