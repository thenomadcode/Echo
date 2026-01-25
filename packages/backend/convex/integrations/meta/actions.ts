import { v } from "convex/values";
import { action, internalQuery } from "../../_generated/server";
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
