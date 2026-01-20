import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { authComponent } from "../auth";

interface AISettings {
  aiTone: string;
  aiGreeting: string;
  aiEscalationKeywords: string[];
}

export const getSettings = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args): Promise<AISettings | null> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser.userId) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return null;
    }

    if (business.ownerId !== authUser.userId) {
      return null;
    }

    return {
      aiTone: business.aiTone ?? "",
      aiGreeting: business.aiGreeting ?? "",
      aiEscalationKeywords: business.aiEscalationKeywords ?? [],
    };
  },
});

export const updateSettings = mutation({
  args: {
    businessId: v.id("businesses"),
    aiTone: v.optional(v.string()),
    aiGreeting: v.optional(v.string()),
    aiEscalationKeywords: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<void> => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser.userId) {
      throw new Error("Not authenticated");
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    if (business.ownerId !== authUser.userId) {
      throw new Error("Not authorized to update this business");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.aiTone !== undefined) {
      updates.aiTone = args.aiTone;
    }
    if (args.aiGreeting !== undefined) {
      updates.aiGreeting = args.aiGreeting;
    }
    if (args.aiEscalationKeywords !== undefined) {
      updates.aiEscalationKeywords = args.aiEscalationKeywords;
    }

    await ctx.db.patch(args.businessId, updates);
  },
});
