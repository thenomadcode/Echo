import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { authComponent } from "../../auth";

function generateStateParameter(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const META_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_show_list",
];

export const startOAuth = action({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<{ authUrl: string; state: string }> => {
    const authResult = await ctx.runQuery(
      internal.integrations.meta.actions.verifyBusinessOwnership,
      { businessId: args.businessId }
    );

    if (!authResult.authorized) {
      throw new Error(authResult.error ?? "Not authorized");
    }

    const existingConnection = await ctx.runQuery(
      internal.integrations.meta.actions.getExistingConnection,
      { businessId: args.businessId }
    );

    if (existingConnection) {
      throw new Error("This business already has a Meta connection. Disconnect first to reconnect.");
    }

    const appId = process.env.META_APP_ID;
    const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL;

    if (!appId) {
      throw new Error("META_APP_ID environment variable not configured");
    }

    if (!siteUrl) {
      throw new Error("Site URL not configured (CONVEX_SITE_URL or SITE_URL)");
    }

    const randomState = generateStateParameter();
    const stateData = `${randomState}|${args.businessId}`;

    const redirectUri = `${siteUrl}/meta/callback`;
    const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");

    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", stateData);
    authUrl.searchParams.set("scope", META_OAUTH_SCOPES.join(","));
    authUrl.searchParams.set("response_type", "code");

    return {
      authUrl: authUrl.toString(),
      state: stateData,
    };
  },
});

export const verifyBusinessOwnership = internalQuery({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<{ authorized: boolean; error?: string }> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return { authorized: false, error: "Not authenticated" };
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return { authorized: false, error: "Business not found" };
    }

    if (business.ownerId !== authUser._id) {
      return { authorized: false, error: "Not authorized to access this business" };
    }

    return { authorized: true };
  },
});

export const getExistingConnection = internalQuery({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    return connection;
  },
});

// ============================================================================
// 24-Hour Messaging Window
// ============================================================================

const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

export const getMessagingWindowStatus = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<{
    isWithinWindow: boolean;
    timeRemainingMs: number;
    lastCustomerMessageAt: number | null;
    windowClosesAt: number | null;
  } | null> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const business = await ctx.db.get(conversation.businessId);
    if (!business || business.ownerId !== authUser._id) {
      return null;
    }

    if (conversation.channel !== "instagram" && conversation.channel !== "messenger") {
      return {
        isWithinWindow: true,
        timeRemainingMs: Infinity,
        lastCustomerMessageAt: conversation.lastCustomerMessageAt,
        windowClosesAt: null,
      };
    }

    const lastCustomerMessageAt = conversation.lastCustomerMessageAt;
    const now = Date.now();
    const windowClosesAt = lastCustomerMessageAt + MESSAGING_WINDOW_MS;
    const timeRemainingMs = Math.max(0, windowClosesAt - now);
    const isWithinWindow = timeRemainingMs > 0;

    return {
      isWithinWindow,
      timeRemainingMs,
      lastCustomerMessageAt,
      windowClosesAt,
    };
  },
});

export const isWithinMessagingWindow = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args): Promise<{
    isWithinWindow: boolean;
    timeRemainingMs: number;
    lastCustomerMessageAt: number | null;
    windowClosesAt: number | null;
  }> => {
    const conversation = await ctx.db.get(args.conversationId);
    
    if (!conversation) {
      return {
        isWithinWindow: false,
        timeRemainingMs: 0,
        lastCustomerMessageAt: null,
        windowClosesAt: null,
      };
    }

    // Only applies to Meta channels
    if (conversation.channel !== "instagram" && conversation.channel !== "messenger") {
      // Non-Meta channels don't have a 24h window restriction
      return {
        isWithinWindow: true,
        timeRemainingMs: Infinity,
        lastCustomerMessageAt: conversation.lastCustomerMessageAt,
        windowClosesAt: null,
      };
    }

    const lastCustomerMessageAt = conversation.lastCustomerMessageAt;
    const now = Date.now();
    const windowClosesAt = lastCustomerMessageAt + MESSAGING_WINDOW_MS;
    const timeRemainingMs = Math.max(0, windowClosesAt - now);
    const isWithinWindow = timeRemainingMs > 0;

    return {
      isWithinWindow,
      timeRemainingMs,
      lastCustomerMessageAt,
      windowClosesAt,
    };
  },
});

const META_GRAPH_API_VERSION = "v19.0";
const META_GRAPH_API_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

type MetaTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

type MetaErrorResponse = {
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
};

type MetaPageAccount = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  tasks?: string[];
};

type MetaPagesResponse = {
  data: MetaPageAccount[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
};

type MetaInstagramAccount = {
  id: string;
  username?: string;
};

type MetaInstagramResponse = {
  instagram_business_account?: MetaInstagramAccount;
};

type MetaPermissionsResponse = {
  data: Array<{
    permission: string;
    status: "granted" | "declined" | "expired";
  }>;
};

export const handleOAuthCallback = internalAction({
  args: {
    code: v.string(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const siteUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL;

    if (!appId || !appSecret) {
      return { success: false, error: "Meta app credentials not configured" };
    }

    if (!siteUrl) {
      return { success: false, error: "Site URL not configured" };
    }

    const redirectUri = `${siteUrl}/meta/callback`;

    try {
      const tokenUrl = new URL(`${META_GRAPH_API_BASE}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("redirect_uri", redirectUri);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("code", args.code);

      const tokenResponse = await fetch(tokenUrl.toString());
      const tokenData = (await tokenResponse.json()) as MetaTokenResponse | MetaErrorResponse;

      if ("error" in tokenData && tokenData.error) {
        console.error("Meta token exchange failed:", tokenData.error);
        return { success: false, error: tokenData.error.message };
      }

      if (!("access_token" in tokenData)) {
        return { success: false, error: "No access token in response" };
      }

      const shortLivedToken = tokenData.access_token;

      const longLivedUrl = new URL(`${META_GRAPH_API_BASE}/oauth/access_token`);
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", appId);
      longLivedUrl.searchParams.set("client_secret", appSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      const longLivedData = (await longLivedResponse.json()) as MetaTokenResponse | MetaErrorResponse;

      if ("error" in longLivedData && longLivedData.error) {
        console.error("Meta long-lived token exchange failed:", longLivedData.error);
        return { success: false, error: longLivedData.error.message };
      }

      if (!("access_token" in longLivedData)) {
        return { success: false, error: "No long-lived access token in response" };
      }

      const userAccessToken = longLivedData.access_token;
      const tokenExpiresIn = longLivedData.expires_in;
      const tokenExpiresAt = tokenExpiresIn ? Date.now() + tokenExpiresIn * 1000 : undefined;

      const permissionsUrl = new URL(`${META_GRAPH_API_BASE}/me/permissions`);
      permissionsUrl.searchParams.set("access_token", userAccessToken);

      const permissionsResponse = await fetch(permissionsUrl.toString());
      const permissionsData = (await permissionsResponse.json()) as MetaPermissionsResponse | MetaErrorResponse;

      const grantedPermissions: string[] = [];
      if ("data" in permissionsData) {
        for (const perm of permissionsData.data) {
          if (perm.status === "granted") {
            grantedPermissions.push(perm.permission);
          }
        }
      }

      const pagesUrl = new URL(`${META_GRAPH_API_BASE}/me/accounts`);
      pagesUrl.searchParams.set("access_token", userAccessToken);
      pagesUrl.searchParams.set("fields", "id,name,access_token,tasks");

      const pagesResponse = await fetch(pagesUrl.toString());
      const pagesData = (await pagesResponse.json()) as MetaPagesResponse | MetaErrorResponse;

      if ("error" in pagesData && pagesData.error) {
        console.error("Meta pages fetch failed:", pagesData.error);
        return { success: false, error: pagesData.error.message };
      }

      if (!("data" in pagesData) || pagesData.data.length === 0) {
        return { success: false, error: "No Facebook Pages found. Please connect a Page with messaging permissions." };
      }

      const page = pagesData.data[0];
      const pageAccessToken = page.access_token;
      const pageId = page.id;
      const pageName = page.name;

      let instagramAccountId: string | undefined;
      let instagramUsername: string | undefined;

      const igUrl = new URL(`${META_GRAPH_API_BASE}/${pageId}`);
      igUrl.searchParams.set("fields", "instagram_business_account{id,username}");
      igUrl.searchParams.set("access_token", pageAccessToken);

      const igResponse = await fetch(igUrl.toString());
      const igData = (await igResponse.json()) as MetaInstagramResponse | MetaErrorResponse;

      if ("instagram_business_account" in igData && igData.instagram_business_account) {
        instagramAccountId = igData.instagram_business_account.id;
        instagramUsername = igData.instagram_business_account.username;
      }

      await ctx.runMutation(internal.integrations.meta.actions.saveConnection, {
        businessId: args.businessId,
        pageId,
        pageName,
        pageAccessToken,
        instagramAccountId,
        instagramUsername,
        permissions: grantedPermissions,
        tokenExpiresAt,
      });

      console.log(`Meta connection saved for business ${args.businessId}: Page "${pageName}" (${pageId})${instagramUsername ? `, Instagram @${instagramUsername}` : ""}`);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Meta OAuth callback error:", message);
      return { success: false, error: message };
    }
  },
});

// ============================================================================
// Message Sending Actions
// ============================================================================

/**
 * Get conversation details including channel info and connection data
 */
export const getConversationWithConnection = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    // Only proceed for Meta channels (instagram, messenger)
    if (conversation.channel !== "instagram" && conversation.channel !== "messenger") {
      return null;
    }

    // Look up metaConnection for the business
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", conversation.businessId))
      .first();

    if (!connection) {
      return null;
    }

    // channelId format: {channel}:{senderId}:{businessAccountId}
    // We need to extract the senderId (recipient) from channelId
    const channelIdParts = conversation.channelId.split(":");
    if (channelIdParts.length < 2) {
      console.error("[sendMessage] Invalid channelId format:", conversation.channelId);
      return null;
    }

    // senderId is the second part (recipient for outgoing messages)
    const recipientId = channelIdParts[1];

    // Determine which ID to use for the Graph API endpoint
    // For Instagram: use instagramAccountId
    // For Messenger: use pageId
    const pageOrIgId = conversation.channel === "instagram"
      ? connection.instagramAccountId
      : connection.pageId;

    if (!pageOrIgId) {
      console.error("[sendMessage] Missing pageOrIgId for channel:", conversation.channel);
      return null;
    }

    return {
      conversation,
      connection,
      recipientId,
      pageOrIgId,
      channel: conversation.channel as "instagram" | "messenger",
    };
  },
});

export const storeSentMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    messageType: v.string(),
    externalId: v.optional(v.string()),
    deliveryStatus: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    richContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      sender: "business",
      content: args.content,
      messageType: args.messageType,
      externalId: args.externalId,
      deliveryStatus: args.deliveryStatus,
      mediaUrl: args.mediaUrl,
      mediaType: args.mediaType,
      richContent: args.richContent,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

const quickReplyValidator = v.object({
  content_type: v.union(v.literal("text"), v.literal("user_phone_number"), v.literal("user_email")),
  title: v.string(),
  payload: v.string(),
  image_url: v.optional(v.string()),
});

const genericTemplateButtonValidator = v.object({
  type: v.union(v.literal("web_url"), v.literal("postback")),
  title: v.string(),
  url: v.optional(v.string()),
  payload: v.optional(v.string()),
});

const genericTemplateElementValidator = v.object({
  title: v.string(),
  subtitle: v.optional(v.string()),
  image_url: v.optional(v.string()),
  default_action: v.optional(v.object({
    type: v.literal("web_url"),
    url: v.string(),
    webview_height_ratio: v.optional(v.union(v.literal("compact"), v.literal("tall"), v.literal("full"))),
  })),
  buttons: v.optional(v.array(genericTemplateButtonValidator)),
});

const messageTagValidator = v.union(
  v.literal("CONFIRMED_EVENT_UPDATE"),
  v.literal("POST_PURCHASE_UPDATE"),
  v.literal("ACCOUNT_UPDATE"),
  v.literal("HUMAN_AGENT")
);

export const sendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("quick_replies"),
      v.literal("generic_template")
    ),
    imageUrl: v.optional(v.string()),
    quickReplies: v.optional(v.array(quickReplyValidator)),
    templateElements: v.optional(v.array(genericTemplateElementValidator)),
    messageTag: v.optional(messageTagValidator),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    messageId?: string;
    externalId?: string;
    error?: string;
    fallbackUsed?: boolean;
    outsideMessagingWindow?: boolean;
  }> => {
    const { MetaMessagingProviderImpl } = await import("./provider");
    type MetaMessageTag = "CONFIRMED_EVENT_UPDATE" | "POST_PURCHASE_UPDATE" | "ACCOUNT_UPDATE" | "HUMAN_AGENT";

    const data = await ctx.runQuery(
      internal.integrations.meta.actions.getConversationWithConnection,
      { conversationId: args.conversationId }
    );

    if (!data) {
      console.error("[sendMessage] Could not get conversation/connection data for:", args.conversationId);
      return {
        success: false,
        error: "Conversation not found or not a Meta channel",
      };
    }

    const { connection, recipientId, pageOrIgId, channel } = data;

    if (!connection.pageAccessToken) {
      console.error("[sendMessage] No page access token for business:", data.conversation.businessId);
      return {
        success: false,
        error: "Meta connection missing access token",
      };
    }

    const windowStatus = await ctx.runQuery(
      internal.integrations.meta.actions.isWithinMessagingWindow,
      { conversationId: args.conversationId }
    );

    let messagingType: "RESPONSE" | "MESSAGE_TAG" = "RESPONSE";
    let messageTag: MetaMessageTag | undefined;
    let outsideMessagingWindow = false;

    if (!windowStatus.isWithinWindow) {
      outsideMessagingWindow = true;
      const hoursAgo = windowStatus.lastCustomerMessageAt
        ? Math.round((Date.now() - windowStatus.lastCustomerMessageAt) / (1000 * 60 * 60))
        : "unknown";
      console.warn(
        `[sendMessage] Outside 24-hour messaging window for conversation ${args.conversationId}. ` +
        `Last customer message was ${hoursAgo} hours ago.`
      );

      if (args.messageTag) {
        messagingType = "MESSAGE_TAG";
        messageTag = args.messageTag;
        console.log(`[sendMessage] Using MESSAGE_TAG with tag: ${messageTag}`);
      } else if (channel === "messenger") {
        messagingType = "MESSAGE_TAG";
        messageTag = "HUMAN_AGENT";
        console.log("[sendMessage] Using HUMAN_AGENT tag for Messenger (outside 24h window)");
      } else {
        console.warn(
          "[sendMessage] Instagram does not support MESSAGE_TAG. Message may fail. " +
          "Consider implementing One-Time Notification (OTN) request flow."
        );
      }
    }

    const provider = new MetaMessagingProviderImpl(
      connection.pageAccessToken,
      pageOrIgId,
      channel,
      { messagingType, messageTag }
    );

    let result: { success: boolean; messageId?: string; error?: string; errorCode?: number; errorSubcode?: number };
    let fallbackUsed = false;
    let richContentJson: string | undefined;

    try {
      switch (args.type) {
        case "image": {
          if (!args.imageUrl) {
            return {
              success: false,
              error: "imageUrl is required for image messages",
            };
          }
          result = await provider.sendImage(recipientId, args.imageUrl, args.content || undefined);
          break;
        }

        case "quick_replies": {
          if (!args.quickReplies || args.quickReplies.length === 0) {
            return {
              success: false,
              error: "quickReplies array is required for quick_replies type",
            };
          }

          if (channel === "instagram") {
            console.log("[sendMessage] Quick replies not supported on Instagram, provider will fallback to text");
            fallbackUsed = true;
          } else if (args.quickReplies.length > 13) {
            console.log(`[sendMessage] Truncating quick replies from ${args.quickReplies.length} to 13 (Messenger limit)`);
          }

          richContentJson = JSON.stringify({ quickReplies: args.quickReplies });
          result = await provider.sendQuickReplies(recipientId, args.content, args.quickReplies);
          break;
        }

        case "generic_template": {
          if (!args.templateElements || args.templateElements.length === 0) {
            return {
              success: false,
              error: "templateElements array is required for generic_template type",
            };
          }

          if (channel === "instagram") {
            console.log("[sendMessage] Generic templates not supported on Instagram, provider will fallback to text");
            fallbackUsed = true;
          } else if (args.templateElements.length > 10) {
            console.log(`[sendMessage] Truncating template elements from ${args.templateElements.length} to 10 (Messenger limit)`);
          }

          richContentJson = JSON.stringify({ templateElements: args.templateElements });
          result = await provider.sendGenericTemplate(recipientId, args.templateElements);
          break;
        }

        case "text":
        default: {
          result = await provider.sendText(recipientId, args.content);
          break;
        }
      }

      console.log(`[sendMessage] ${channel} message sent. Success: ${result.success}, mid: ${result.messageId}${fallbackUsed ? " (fallback used)" : ""}`);

      const storedMessageId = await ctx.runMutation(
        internal.integrations.meta.actions.storeSentMessage,
        {
          conversationId: args.conversationId,
          content: args.content,
          messageType: fallbackUsed ? "text" : args.type,
          externalId: result.messageId,
          deliveryStatus: result.success ? "sent" : "failed",
          mediaUrl: args.type === "image" ? args.imageUrl : undefined,
          mediaType: args.type === "image" ? "image/*" : undefined,
          richContent: richContentJson,
        }
      );

      if (!result.success) {
        console.error("[sendMessage] Meta API error:", {
          error: result.error,
          errorCode: result.errorCode,
          errorSubcode: result.errorSubcode,
        });
      }

      return {
        success: result.success,
        messageId: storedMessageId,
        externalId: result.messageId,
        error: result.error,
        fallbackUsed,
        outsideMessagingWindow,
      };
    } catch (error) {
      console.error("[sendMessage] Unexpected error:", error);

      const storedMessageId = await ctx.runMutation(
        internal.integrations.meta.actions.storeSentMessage,
        {
          conversationId: args.conversationId,
          content: args.content,
          messageType: args.type,
          deliveryStatus: "failed",
          mediaUrl: args.type === "image" ? args.imageUrl : undefined,
          mediaType: args.type === "image" ? "image/*" : undefined,
          richContent: richContentJson,
        }
      );

      return {
        success: false,
        messageId: storedMessageId,
        error: error instanceof Error ? error.message : "Unknown error sending message",
        fallbackUsed,
        outsideMessagingWindow,
      };
    }
  },
});

export const saveConnection = internalMutation({
  args: {
    businessId: v.id("businesses"),
    pageId: v.string(),
    pageName: v.string(),
    pageAccessToken: v.string(),
    instagramAccountId: v.optional(v.string()),
    instagramUsername: v.optional(v.string()),
    permissions: v.array(v.string()),
    tokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existingConnection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    const now = Date.now();

    if (existingConnection) {
      await ctx.db.patch(existingConnection._id, {
        pageId: args.pageId,
        pageName: args.pageName,
        pageAccessToken: args.pageAccessToken,
        instagramAccountId: args.instagramAccountId,
        instagramUsername: args.instagramUsername,
        permissions: args.permissions,
        tokenExpiresAt: args.tokenExpiresAt,
        verified: true,
        updatedAt: now,
      });
      return existingConnection._id;
    }

    const connectionId = await ctx.db.insert("metaConnections", {
      businessId: args.businessId,
      pageId: args.pageId,
      pageName: args.pageName,
      pageAccessToken: args.pageAccessToken,
      instagramAccountId: args.instagramAccountId,
      instagramUsername: args.instagramUsername,
      permissions: args.permissions,
      webhooksSubscribed: false,
      verified: true,
      tokenExpiresAt: args.tokenExpiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return connectionId;
  },
});

// ============================================================================
// Connection Management Actions
// ============================================================================

export const getConnectionForDisconnect = internalQuery({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      return null;
    }

    return {
      _id: connection._id,
      pageId: connection.pageId,
      pageAccessToken: connection.pageAccessToken,
    };
  },
});

export const deleteConnection = internalMutation({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (connection) {
      await ctx.db.delete(connection._id);
    }

    return { deleted: !!connection };
  },
});

export const disconnect = action({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const authResult = await ctx.runQuery(
      internal.integrations.meta.actions.verifyBusinessOwnership,
      { businessId: args.businessId }
    );

    if (!authResult.authorized) {
      return { success: false, error: authResult.error ?? "Not authorized" };
    }

    const connection = await ctx.runQuery(
      internal.integrations.meta.actions.getConnectionForDisconnect,
      { businessId: args.businessId }
    );

    if (!connection) {
      return { success: false, error: "No Meta connection found for this business" };
    }

    try {
      const unsubscribeUrl = new URL(`${META_GRAPH_API_BASE}/${connection.pageId}/subscribed_apps`);
      unsubscribeUrl.searchParams.set("access_token", connection.pageAccessToken);

      const response = await fetch(unsubscribeUrl.toString(), {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.warn("Failed to unsubscribe webhooks:", errorData);
      }
    } catch (error) {
      console.warn("Error unsubscribing webhooks (continuing with disconnect):", error);
    }

    await ctx.runMutation(
      internal.integrations.meta.actions.deleteConnection,
      { businessId: args.businessId }
    );

    console.log(`Disconnected Meta connection for business ${args.businessId}`);

    return { success: true };
  },
});

export const getConnectionForWebhooks = internalQuery({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      return null;
    }

    return {
      _id: connection._id,
      pageId: connection.pageId,
      pageAccessToken: connection.pageAccessToken,
      webhooksSubscribed: connection.webhooksSubscribed,
    };
  },
});

export const updateWebhookStatus = internalMutation({
  args: {
    businessId: v.id("businesses"),
    webhooksSubscribed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (connection) {
      await ctx.db.patch(connection._id, {
        webhooksSubscribed: args.webhooksSubscribed,
        updatedAt: Date.now(),
      });
    }
  },
});

type MetaSubscribeResponse = {
  success?: boolean;
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

export const subscribeWebhooks = action({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const authResult = await ctx.runQuery(
      internal.integrations.meta.actions.verifyBusinessOwnership,
      { businessId: args.businessId }
    );

    if (!authResult.authorized) {
      return { success: false, error: authResult.error ?? "Not authorized" };
    }

    const connection = await ctx.runQuery(
      internal.integrations.meta.actions.getConnectionForWebhooks,
      { businessId: args.businessId }
    );

    if (!connection) {
      return { success: false, error: "No Meta connection found for this business" };
    }

    const subscribedFields = ["messages", "messaging_postbacks", "messaging_optins"];

    try {
      const subscribeUrl = new URL(`${META_GRAPH_API_BASE}/${connection.pageId}/subscribed_apps`);

      const response = await fetch(subscribeUrl.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${connection.pageAccessToken}`,
        },
        body: JSON.stringify({
          subscribed_fields: subscribedFields,
        }),
      });

      const data = (await response.json()) as MetaSubscribeResponse;

      if (!response.ok || data.error) {
        const errorMessage = data.error?.message ?? `HTTP ${response.status}`;
        console.error("Failed to subscribe webhooks:", data);
        return { success: false, error: `Failed to subscribe webhooks: ${errorMessage}` };
      }

      await ctx.runMutation(
        internal.integrations.meta.actions.updateWebhookStatus,
        { businessId: args.businessId, webhooksSubscribed: true }
      );

      console.log(`Subscribed to Meta webhooks for business ${args.businessId}: ${subscribedFields.join(", ")}`);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Error subscribing webhooks:", message);
      return { success: false, error: message };
    }
  },
});

// ============================================================================
// Test Connection Action
// ============================================================================

type MetaDebugTokenResponse = {
  data?: {
    is_valid: boolean;
    app_id: string;
    user_id?: string;
    expires_at?: number;
    scopes?: string[];
  };
  error?: {
    message: string;
    type: string;
    code: number;
  };
};

export const getConnectionForTest = internalQuery({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      return null;
    }

    return {
      _id: connection._id,
      pageId: connection.pageId,
      pageAccessToken: connection.pageAccessToken,
    };
  },
});

export const updateConnectionVerified = internalMutation({
  args: {
    businessId: v.id("businesses"),
    verified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (connection) {
      await ctx.db.patch(connection._id, {
        verified: args.verified,
        updatedAt: Date.now(),
      });
    }
  },
});

export const testConnection = action({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; tokenExpires?: number }> => {
    // Verify ownership
    const authResult = await ctx.runQuery(
      internal.integrations.meta.actions.verifyBusinessOwnership,
      { businessId: args.businessId }
    );

    if (!authResult.authorized) {
      return { success: false, error: authResult.error ?? "Not authorized" };
    }

    // Get connection
    const connection = await ctx.runQuery(
      internal.integrations.meta.actions.getConnectionForTest,
      { businessId: args.businessId }
    );

    if (!connection) {
      return { success: false, error: "No Meta connection found for this business" };
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      return { success: false, error: "Meta app credentials not configured" };
    }

    try {
      // Test token validity by calling debug_token endpoint
      // This verifies the token is still valid and has not been revoked
      const debugUrl = new URL(`${META_GRAPH_API_BASE}/debug_token`);
      debugUrl.searchParams.set("input_token", connection.pageAccessToken);
      debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);

      const response = await fetch(debugUrl.toString());
      const data = (await response.json()) as MetaDebugTokenResponse;

      if ("error" in data && data.error) {
        console.error("Token debug error:", data.error);
        await ctx.runMutation(
          internal.integrations.meta.actions.updateConnectionVerified,
          { businessId: args.businessId, verified: false }
        );
        return { success: false, error: data.error.message };
      }

      if (!data.data?.is_valid) {
        console.warn("Token is no longer valid for business:", args.businessId);
        await ctx.runMutation(
          internal.integrations.meta.actions.updateConnectionVerified,
          { businessId: args.businessId, verified: false }
        );
        return { success: false, error: "Token is no longer valid. Please reconnect." };
      }

      // Token is valid - also verify we can make an API call
      const meUrl = new URL(`${META_GRAPH_API_BASE}/${connection.pageId}`);
      meUrl.searchParams.set("fields", "id,name");
      meUrl.searchParams.set("access_token", connection.pageAccessToken);

      const meResponse = await fetch(meUrl.toString());
      const meData = await meResponse.json();

      if (!meResponse.ok || meData.error) {
        console.error("Page API call failed:", meData);
        await ctx.runMutation(
          internal.integrations.meta.actions.updateConnectionVerified,
          { businessId: args.businessId, verified: false }
        );
        return { success: false, error: meData.error?.message ?? "Failed to verify page access" };
      }

      // Connection is working - update verified status
      await ctx.runMutation(
        internal.integrations.meta.actions.updateConnectionVerified,
        { businessId: args.businessId, verified: true }
      );

      console.log(`Connection test passed for business ${args.businessId}`);

      return { 
        success: true, 
        tokenExpires: data.data.expires_at 
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Connection test error:", message);
      return { success: false, error: message };
    }
  },
});
