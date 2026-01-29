import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery } from "../../_generated/server";
import { getTemplate, renderTemplate } from "./templates";
import { TwilioWhatsAppProvider } from "./twilio";
import type { Button, ListSection } from "./types";
import { isWithin24HourWindow } from "./window";

const WHATSAPP_CLOUD_API_VERSION = "v21.0";
const WHATSAPP_CLOUD_API_BASE = `https://graph.facebook.com/${WHATSAPP_CLOUD_API_VERSION}`;

type ConversationData = {
	conversation: Doc<"conversations">;
	business: Doc<"businesses">;
	whatsappConnection: Doc<"whatsappConnections">;
	customerPhone: string;
} | null;

type SendMessageResult = {
	success: true;
	messageId: string | undefined;
};

export const loadConversationData = internalQuery({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args): Promise<ConversationData> => {
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return null;
		}

		const business = await ctx.db.get(conversation.businessId);
		if (!business) {
			return null;
		}

		const whatsappConnection = await ctx.db
			.query("whatsappConnections")
			.withIndex("by_business", (q) => q.eq("businessId", conversation.businessId))
			.first();

		if (!whatsappConnection) {
			return null;
		}

		return {
			conversation,
			business,
			whatsappConnection,
			customerPhone: conversation.customerId,
		};
	},
});

export const storeOutgoingMessage = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		content: v.string(),
		externalId: v.optional(v.string()),
		deliveryStatus: v.string(),
		messageType: v.optional(v.string()),
		richContent: v.optional(v.string()),
		mediaUrl: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<Id<"messages">> => {
		const messageId = await ctx.db.insert("messages", {
			conversationId: args.conversationId,
			sender: "business",
			content: args.content,
			externalId: args.externalId,
			deliveryStatus: args.deliveryStatus,
			messageType: args.messageType,
			richContent: args.richContent,
			mediaUrl: args.mediaUrl,
			createdAt: Date.now(),
		});

		return messageId;
	},
});

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const buttonValidator = v.object({
	id: v.string(),
	title: v.string(),
});

const listRowValidator = v.object({
	id: v.string(),
	title: v.string(),
	description: v.optional(v.string()),
});

const listSectionValidator = v.object({
	title: v.string(),
	rows: v.array(listRowValidator),
});

export const sendMessage = action({
	args: {
		messageId: v.optional(v.id("messages")),
		conversationId: v.id("conversations"),
		content: v.string(),
		type: v.union(
			v.literal("text"),
			v.literal("buttons"),
			v.literal("list"),
			v.literal("image"),
			v.literal("template"),
		),
		buttons: v.optional(v.array(buttonValidator)),
		sections: v.optional(v.array(listSectionValidator)),
		imageUrl: v.optional(v.string()),
		caption: v.optional(v.string()),
		buttonText: v.optional(v.string()),
		templateName: v.optional(v.string()),
		templateVariables: v.optional(v.any()),
	},
	handler: async (ctx, args): Promise<SendMessageResult> => {
		const { conversationId, content, type } = args;

		const data: ConversationData = await ctx.runQuery(
			internal.integrations.whatsapp.actions.loadConversationData,
			{ conversationId },
		);

		if (!data) {
			throw new Error("Conversation not found or WhatsApp not configured");
		}

		const { whatsappConnection, customerPhone, conversation } = data;

		const withinWindow = isWithin24HourWindow(conversation.lastCustomerMessageAt);

		if (!withinWindow && type !== "template") {
			throw new Error(
				"24-hour messaging window expired. Only template messages can be sent. " +
					"Use type: 'template' with a templateName to send a pre-approved message.",
			);
		}

		const provider = new TwilioWhatsAppProvider(
			whatsappConnection.credentials,
			whatsappConnection.phoneNumber,
		);

		const maxRetries = 3;
		let lastError: Error | null = null;
		let usedFallback = false;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			let result;
			let actualContent = content;
			let richContent: string | undefined;
			let mediaUrl: string | undefined;

			switch (type) {
				case "text":
					result = await provider.sendText(customerPhone, content);
					break;

				case "buttons":
					if (!args.buttons || args.buttons.length === 0) {
						throw new Error("Buttons array is required for buttons message type");
					}
					if (args.buttons.length > 3) {
						throw new Error("WhatsApp allows maximum 3 buttons per message");
					}
					richContent = JSON.stringify({ buttons: args.buttons });
					result = await provider.sendButtons(customerPhone, content, args.buttons as Button[]);
					if (!result.success && !usedFallback) {
						usedFallback = true;
						const fallbackText = formatButtonsAsFallback(content, args.buttons);
						result = await provider.sendText(customerPhone, fallbackText);
						actualContent = fallbackText;
					}
					break;

				case "list":
					if (!args.sections || args.sections.length === 0) {
						throw new Error("Sections array is required for list message type");
					}
					richContent = JSON.stringify({ sections: args.sections });
					result = await provider.sendList(
						customerPhone,
						content,
						args.sections as ListSection[],
						args.buttonText,
					);
					if (!result.success && !usedFallback) {
						usedFallback = true;
						const fallbackText = formatListAsFallback(content, args.sections, args.buttonText);
						result = await provider.sendText(customerPhone, fallbackText);
						actualContent = fallbackText;
					}
					break;

				case "image":
					if (!args.imageUrl) {
						throw new Error("imageUrl is required for image message type");
					}
					mediaUrl = args.imageUrl;
					actualContent = args.caption || content;
					result = await provider.sendImage(customerPhone, args.imageUrl, args.caption);
					if (!result.success && !usedFallback) {
						usedFallback = true;
						const fallbackText = formatImageAsFallback(args.imageUrl, args.caption || content);
						result = await provider.sendText(customerPhone, fallbackText);
						actualContent = fallbackText;
					}
					break;

				case "template": {
					if (!args.templateName) {
						throw new Error("templateName is required for template message type");
					}
					const template = getTemplate(args.templateName);
					if (!template) {
						throw new Error(`Template '${args.templateName}' not found`);
					}
					const templateVars = (args.templateVariables || {}) as Record<number, string>;
					actualContent = renderTemplate(template, templateVars);
					richContent = JSON.stringify({
						templateName: args.templateName,
						variables: templateVars,
					});
					result = await provider.sendText(customerPhone, actualContent);
					break;
				}
			}

			if (!result) {
				throw new Error("Unexpected error: no message result");
			}

			if (result.success) {
				if (args.messageId) {
					await ctx.runMutation(internal.messages.updateMessageDelivery, {
						messageId: args.messageId,
						externalId: result.messageId,
						deliveryStatus: "sent",
					});
				} else {
					await ctx.runMutation(internal.integrations.whatsapp.actions.storeOutgoingMessage, {
						conversationId,
						content: actualContent,
						externalId: result.messageId,
						deliveryStatus: "sent",
						messageType: usedFallback ? "text" : type,
						richContent,
						mediaUrl,
					});
				}

				return {
					success: true,
					messageId: result.messageId,
				};
			}

			const isRateLimitError =
				result.error?.includes("429") ||
				result.error?.includes("rate limit") ||
				result.error?.includes("Too Many Requests");

			if (!isRateLimitError) {
				lastError = new Error(result.error || "Failed to send message");
				break;
			}

			const backoffMs = 2 ** attempt * 1000;
			await sleep(backoffMs);
			lastError = new Error(result.error || "Rate limited");
		}

		if (args.messageId) {
			await ctx.runMutation(internal.messages.updateMessageDelivery, {
				messageId: args.messageId,
				deliveryStatus: "failed",
				errorMessage: lastError?.message || "Failed to send message after retries",
			});
		} else {
			await ctx.runMutation(internal.integrations.whatsapp.actions.storeOutgoingMessage, {
				conversationId,
				content,
				deliveryStatus: "failed",
				messageType: type,
			});
		}

		throw lastError || new Error("Failed to send message after retries");
	},
});

function formatButtonsAsFallback(
	body: string,
	buttons: Array<{ id: string; title: string }>,
): string {
	const buttonText = buttons.map((btn, idx) => `${idx + 1}. ${btn.title}`).join("\n");
	return `${body}\n\n${buttonText}\n\nReply with the number of your choice.`;
}

function formatListAsFallback(
	body: string,
	sections: Array<{
		title: string;
		rows: Array<{ id: string; title: string; description?: string }>;
	}>,
	buttonText?: string,
): string {
	const sectionTexts = sections.map((section) => {
		const rowsText = section.rows
			.map((row, idx) => {
				const desc = row.description ? ` - ${row.description}` : "";
				return `  ${idx + 1}. ${row.title}${desc}`;
			})
			.join("\n");
		return `*${section.title}*\n${rowsText}`;
	});
	return `${body}\n\n${sectionTexts.join("\n\n")}\n\n${buttonText || "Reply with your choice."}`;
}

function formatImageAsFallback(imageUrl: string, caption: string): string {
	return `${caption}\n\n[Image: ${imageUrl}]`;
}

export const getConnectionForReadReceipt = internalQuery({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("whatsappConnections")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.first();

		if (!connection) {
			return null;
		}

		const hasCloudApiAccess = !!(connection.credentials.apiKey && connection.phoneNumberId);

		if (!hasCloudApiAccess) {
			return null;
		}

		return {
			phoneNumberId: connection.phoneNumberId,
			apiKey: connection.credentials.apiKey,
		};
	},
});

export const sendReadReceipt = internalAction({
	args: {
		businessId: v.id("businesses"),
		messageId: v.string(),
	},
	handler: async (ctx, args): Promise<void> => {
		const connection = await ctx.runQuery(
			internal.integrations.whatsapp.actions.getConnectionForReadReceipt,
			{ businessId: args.businessId },
		);

		if (!connection) {
			return;
		}

		const { phoneNumberId, apiKey } = connection;

		try {
			const url = `${WHATSAPP_CLOUD_API_BASE}/${phoneNumberId}/messages`;

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					messaging_product: "whatsapp",
					status: "read",
					message_id: args.messageId,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.warn("[sendReadReceipt] Failed:", errorData);
				return;
			}
		} catch (error) {
			console.warn(
				"[sendReadReceipt] Error:",
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	},
});
