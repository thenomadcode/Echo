import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import type { Id } from "./_generated/dataModel";

export const sendAsHuman = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"messages">> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.assignedTo !== authUser._id) {
      throw new Error("Conversation is not assigned to you");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      sender: "human",
      content: args.content,
      mediaUrl: args.mediaUrl,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.messages.sendToWhatsApp, {
      conversationId: args.conversationId,
      messageId,
      content: args.content,
      mediaUrl: args.mediaUrl,
    });

    return messageId;
  },
});

export const sendToWhatsApp = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    content: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      await ctx.db.patch(args.messageId, {
        deliveryStatus: "failed",
        errorMessage: "Conversation not found",
      });
      return;
    }

    const whatsappConnection = await ctx.db
      .query("whatsappConnections")
      .withIndex("by_business", (q) => q.eq("businessId", conversation.businessId))
      .first();

    if (!whatsappConnection || !whatsappConnection.credentials.accountSid || !whatsappConnection.credentials.authToken) {
      await ctx.db.patch(args.messageId, {
        deliveryStatus: "failed",
        errorMessage: "WhatsApp not configured",
      });
      return;
    }

    const customerPhone = conversation.customerId;
    const businessPhone = whatsappConnection.phoneNumber;

    const authString = btoa(`${whatsappConnection.credentials.accountSid}:${whatsappConnection.credentials.authToken}`);
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${whatsappConnection.credentials.accountSid}/Messages.json`;

    const body = new URLSearchParams();
    body.append("From", `whatsapp:${businessPhone}`);
    body.append("To", `whatsapp:${customerPhone}`);
    body.append("Body", args.content);

    if (args.mediaUrl) {
      body.append("MediaUrl", args.mediaUrl);
    }

    try {
      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await ctx.db.patch(args.messageId, {
          deliveryStatus: "failed",
          errorMessage: errorText.slice(0, 500),
        });
        return;
      }

      const result = await response.json();
      await ctx.db.patch(args.messageId, {
        externalId: result.sid,
        deliveryStatus: "sent",
      });
    } catch (error) {
      await ctx.db.patch(args.messageId, {
        deliveryStatus: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
