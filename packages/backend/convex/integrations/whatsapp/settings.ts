import { v } from "convex/values";
import { mutation, query, action, internalQuery, internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
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
      .query("whatsappConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      return {
        connected: false,
        provider: null,
        phoneNumber: null,
        verified: false,
        lastMessageAt: null,
        createdAt: null,
      };
    }

    const lastConversation = await ctx.db
      .query("conversations")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .order("desc")
      .first();

    return {
      connected: true,
      provider: connection.provider,
      phoneNumber: connection.phoneNumber,
      verified: connection.verified,
      lastMessageAt: lastConversation?.lastCustomerMessageAt ?? null,
      createdAt: connection.createdAt,
    };
  },
});

export const saveCredentials = mutation({
  args: {
    businessId: v.id("businesses"),
    provider: v.string(),
    phoneNumber: v.string(),
    phoneNumberId: v.optional(v.string()),
    accountSid: v.optional(v.string()),
    authToken: v.optional(v.string()),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to update this business");
    }

    const existing = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    const credentials = {
      accountSid: args.accountSid,
      authToken: args.authToken,
      apiKey: args.apiKey,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        phoneNumber: args.phoneNumber,
        phoneNumberId: args.phoneNumberId || "",
        credentials,
        verified: false,
      });
      return existing._id;
    }

    const connectionId = await ctx.db.insert("whatsappConnections", {
      businessId: args.businessId,
      provider: args.provider,
      phoneNumber: args.phoneNumber,
      phoneNumberId: args.phoneNumberId || "",
      credentials,
      verified: false,
      createdAt: Date.now(),
    });

    return connectionId;
  },
});

export const markVerified = internalMutation({
  args: {
    businessId: v.id("businesses"),
    verified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (!connection) {
      throw new Error("No WhatsApp connection found");
    }

    await ctx.db.patch(connection._id, {
      verified: args.verified,
    });

    return connection._id;
  },
});

export const getConnectionForTest = internalQuery({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    return connection;
  },
});

export const testConnection = action({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const connection = await ctx.runQuery(
      internal.integrations.whatsapp.settings.getConnectionForTest,
      { businessId: args.businessId }
    );

    if (!connection) {
      return {
        success: false,
        error: "No WhatsApp connection configured. Please save credentials first.",
      };
    }

    if (connection.provider !== "twilio") {
      return {
        success: false,
        error: `Provider '${connection.provider}' is not yet supported for connection testing.`,
      };
    }

    if (!connection.credentials.accountSid || !connection.credentials.authToken) {
      return {
        success: false,
        error: "Missing Twilio credentials (Account SID and Auth Token required).",
      };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${connection.credentials.accountSid}.json`;
      const auth = btoa(`${connection.credentials.accountSid}:${connection.credentials.authToken}`);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 401) {
          return {
            success: false,
            error: "Invalid Twilio credentials. Please check your Account SID and Auth Token.",
          };
        }
        return {
          success: false,
          error: `Twilio API error: ${response.status} - ${errorBody}`,
        };
      }

      await ctx.runMutation(
        internal.integrations.whatsapp.settings.markVerified,
        { businessId: args.businessId, verified: true }
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect to Twilio API",
      };
    }
  },
});
