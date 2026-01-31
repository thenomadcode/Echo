/**
 * Unified AI Message Processing
 *
 * Single entry point for AI response generation regardless of channel.
 * Called by webhook handlers after message ingestion and initial acknowledgements.
 */

import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";

type Channel = "whatsapp" | "instagram" | "messenger";

interface ProcessResult {
	success: boolean;
	toolsUsed?: string[];
	retry?: boolean;
}

/**
 * Process message with AI and send response back to customer.
 * Uses tool-based agent flow (not intent-based).
 */
export const processIncomingMessage = internalAction({
	args: {
		conversationId: v.id("conversations"),
		message: v.string(),
		channel: v.union(v.literal("whatsapp"), v.literal("instagram"), v.literal("messenger")),
	},
	handler: async (ctx, args): Promise<ProcessResult> => {
		const { conversationId, message, channel } = args;

		try {
			console.log(`[MessageHandler] START ${channel} conversation ${conversationId}`);
			const processingStartedAt = Date.now();
			await ctx.runMutation(internal.ai.process.scheduleProcessingCleanup, {
				conversationId,
				startedAt: processingStartedAt,
			});

			await ctx.runMutation(internal.ai.process.setAiProcessingState, {
				conversationId,
				isProcessing: true,
			});

			console.log(`[MessageHandler] Calling processWithAgent for ${conversationId}`);
			const result = await ctx.runAction(api.ai.agent.processWithAgent, {
				conversationId,
				message,
			});
			console.log(
				`[MessageHandler] processWithAgent returned for ${conversationId}, tools:`,
				result.toolsUsed,
			);

			await sendResponse(ctx, conversationId, result.response, channel);

			await ctx.runMutation(internal.ai.process.setAiProcessingState, {
				conversationId,
				isProcessing: false,
			});

			return {
				success: true,
				toolsUsed: result.toolsUsed,
			};
		} catch (error) {
			await ctx.runMutation(internal.ai.process.setAiProcessingState, {
				conversationId,
				isProcessing: false,
			});

			console.error(`[AI Handler] Failed for ${conversationId}:`, error);

			if (error instanceof Error && error.message.includes("429")) {
				console.log(`[AI Handler] Rate limited, retrying in 30s for ${conversationId}`);
				await ctx.scheduler.runAfter(
					30000,
					internal.ai.messageHandler.processIncomingMessage,
					args,
				);
				return { success: false, retry: true };
			}

			throw error;
		}
	},
});

async function sendResponse(
	ctx: ActionCtx,
	conversationId: Id<"conversations">,
	content: string,
	channel: Channel,
): Promise<void> {
	if (channel === "whatsapp") {
		await ctx.runAction(api.integrations.whatsapp.actions.sendMessage, {
			conversationId,
			content,
			type: "text",
		});
	} else {
		await ctx.runAction(api.integrations.meta.actions.sendMessage, {
			conversationId,
			content,
			type: "text",
		});
	}
}
