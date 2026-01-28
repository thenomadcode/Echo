import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireBusinessOwnership } from "../lib/auth";

interface AISettings {
	aiTone: string;
}

interface UsageStats {
	totalTokens: number;
	totalConversations: number;
	avgLatencyMs: number;
	estimatedCostUsd: number;
}

export const getSettings = query({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<AISettings | null> => {
		const isOwner = await isBusinessOwner(ctx, args.businessId);
		if (!isOwner) {
			return null;
		}

		const business = await ctx.db.get(args.businessId);
		return {
			aiTone: business.aiTone ?? "",
		};
	},
});

export const updateSettings = mutation({
	args: {
		businessId: v.id("businesses"),
		aiTone: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<void> => {
		await requireBusinessOwnership(ctx, args.businessId);

		const updates: Record<string, unknown> = {
			updatedAt: Date.now(),
		};

		if (args.aiTone !== undefined) {
			updates.aiTone = args.aiTone;
		}

		await ctx.db.patch(args.businessId, updates);
	},
});

const COST_PER_1K_TOKENS = 0.00015;

export const getUsageStats = query({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args): Promise<UsageStats | null> => {
		const isOwner = await isBusinessOwner(ctx, args.businessId);
		if (!isOwner) {
			return null;
		}

		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.collect();

		const conversationIds = new Set(conversations.map((c) => c._id));

		const allLogs = await ctx.db.query("aiLogs").collect();
		const businessLogs = allLogs.filter((log) => conversationIds.has(log.conversationId));

		const now = Date.now();
		const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
		const thisMonthLogs = businessLogs.filter((log) => log.createdAt >= thirtyDaysAgo);

		const totalTokens = thisMonthLogs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0);
		const totalConversations = new Set(thisMonthLogs.map((log) => log.conversationId)).size;
		const avgLatencyMs =
			thisMonthLogs.length > 0
				? thisMonthLogs.reduce((sum, log) => sum + (log.latencyMs || 0), 0) / thisMonthLogs.length
				: 0;
		const estimatedCostUsd = (totalTokens / 1000) * COST_PER_1K_TOKENS;

		return {
			totalTokens,
			totalConversations,
			avgLatencyMs: Math.round(avgLatencyMs),
			estimatedCostUsd: Math.round(estimatedCostUsd * 100) / 100,
		};
	},
});
