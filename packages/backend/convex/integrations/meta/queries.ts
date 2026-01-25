import { v } from "convex/values";
import { query } from "../../_generated/server";
import { authComponent } from "../../auth";

export const getConnectionStatus = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return null;
    }

    if (business.ownerId !== authUser._id) {
      return null;
    }

    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      return {
        connected: false,
        pageId: null,
        pageName: null,
        instagramAccountId: null,
        instagramUsername: null,
        permissions: [],
        webhooksSubscribed: false,
        verified: false,
        lastMessageAt: null,
        tokenExpiresAt: null,
        createdAt: null,
      };
    }

    return {
      connected: true,
      pageId: connection.pageId,
      pageName: connection.pageName,
      instagramAccountId: connection.instagramAccountId ?? null,
      instagramUsername: connection.instagramUsername ?? null,
      permissions: connection.permissions,
      webhooksSubscribed: connection.webhooksSubscribed,
      verified: connection.verified,
      lastMessageAt: connection.lastMessageAt ?? null,
      tokenExpiresAt: connection.tokenExpiresAt ?? null,
      createdAt: connection.createdAt,
    };
  },
});

export const getConnectedAccounts = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return null;
    }

    if (business.ownerId !== authUser._id) {
      return null;
    }

    const connection = await ctx.db
      .query("metaConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      return {
        pages: [],
        instagramAccounts: [],
      };
    }

    const pages = [
      {
        id: connection.pageId,
        name: connection.pageName,
        hasMessagingPermission: connection.permissions.includes("pages_messaging"),
      },
    ];

    const instagramAccounts = connection.instagramAccountId
      ? [
          {
            id: connection.instagramAccountId,
            username: connection.instagramUsername ?? null,
          },
        ]
      : [];

    return {
      pages,
      instagramAccounts,
    };
  },
});
