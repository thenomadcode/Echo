import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { authComponent } from "../../auth";
import type { Id } from "../../_generated/dataModel";

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
