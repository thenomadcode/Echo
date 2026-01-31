import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
} from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { detectEscalation } from "./escalation";
import { type Intent, type Message, serializeIntent } from "./types";

type ProcessMessageResult = {
	response: string;
	intent: Intent;
	shouldEscalate: boolean;
	detectedLanguage: string;
	messageId: Id<"messages">;
};

interface CustomerContextProfile {
	name?: string;
	phone: string;
	preferredLanguage?: string;
	firstSeenAt: number;
	lastSeenAt: number;
	totalOrders: number;
	totalSpent: number;
}

interface CustomerContextAddress {
	label: string;
	address: string;
	isDefault: boolean;
}

interface CustomerContextMemory {
	allergies: string[];
	restrictions: string[];
	preferences: string[];
	behaviors: string[];
}

interface CustomerContext {
	profile: CustomerContextProfile;
	addresses: CustomerContextAddress[];
	memory: CustomerContextMemory;
	businessNotes: string;
}

interface ConversationContext {
	conversation: Doc<"conversations">;
	business: Doc<"businesses">;
	products: Doc<"products">[];
	messages: Doc<"messages">[];
	customerContext: CustomerContext | null;
}

export const loadContext = internalQuery({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args): Promise<ConversationContext | null> => {
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return null;
		}

		const business = await ctx.db.get(conversation.businessId);
		if (!business) {
			return null;
		}

		const products = await ctx.db
			.query("products")
			.withIndex("by_business", (q) =>
				q.eq("businessId", conversation.businessId as unknown as string).eq("deleted", false),
			)
			.collect();

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.order("desc")
			.take(20);

		let customerContext: CustomerContext | null = null;
		if (conversation.customerRecordId) {
			const customer = await ctx.db.get(conversation.customerRecordId);
			if (customer) {
				const [addresses, memories, notes] = await Promise.all([
					ctx.db
						.query("customerAddresses")
						.withIndex("by_customer", (q) => q.eq("customerId", conversation.customerRecordId!))
						.collect(),
					ctx.db
						.query("customerMemory")
						.withIndex("by_customer", (q) => q.eq("customerId", conversation.customerRecordId!))
						.collect(),
					ctx.db
						.query("customerNotes")
						.withIndex("by_customer", (q) => q.eq("customerId", conversation.customerRecordId!))
						.collect(),
				]);

				const sortedAddresses = addresses
					.sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt))
					.map((a) => ({ label: a.label, address: a.address, isDefault: a.isDefault }));

				const allergies = memories.filter((m) => m.category === "allergy").map((m) => m.fact);
				const restrictions = memories
					.filter((m) => m.category === "restriction")
					.map((m) => m.fact);
				const preferences = memories.filter((m) => m.category === "preference").map((m) => m.fact);
				const behaviors = memories.filter((m) => m.category === "behavior").map((m) => m.fact);

				const businessNotes = notes
					.filter((n) => !n.staffOnly)
					.sort((a, b) => b.createdAt - a.createdAt)
					.map((n) => n.note)
					.join("\n");

				customerContext = {
					profile: {
						name: customer.name,
						phone: customer.phone,
						preferredLanguage: customer.preferredLanguage,
						firstSeenAt: customer.firstSeenAt,
						lastSeenAt: customer.lastSeenAt,
						totalOrders: customer.totalOrders,
						totalSpent: customer.totalSpent,
					},
					addresses: sortedAddresses,
					memory: { allergies, restrictions, preferences, behaviors },
					businessNotes,
				};
			}
		}

		return {
			conversation,
			business,
			products,
			messages: messages.reverse(),
			customerContext,
		};
	},
});

const pendingOrderItemValidator = v.object({
	productQuery: v.string(),
	quantity: v.number(),
	productId: v.optional(v.id("products")),
	price: v.optional(v.number()),
});

const pendingOrderValidator = v.object({
	items: v.array(pendingOrderItemValidator),
	total: v.optional(v.number()),
});

const pendingDeliveryValidator = v.object({
	type: v.union(v.literal("pickup"), v.literal("delivery")),
	address: v.optional(v.string()),
});

export const updateConversation = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		detectedLanguage: v.optional(v.string()),
		state: v.optional(v.string()),
		pendingOrder: v.optional(pendingOrderValidator),
		pendingDelivery: v.optional(pendingDeliveryValidator),
		escalationReason: v.optional(v.string()),
		clearPendingData: v.optional(v.boolean()),
		clearPendingDelivery: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const updates: Record<string, unknown> = {
			updatedAt: Date.now(),
		};

		if (args.detectedLanguage !== undefined) {
			updates.detectedLanguage = args.detectedLanguage;
		}
		if (args.state !== undefined) {
			updates.state = args.state;
		}
		if (args.pendingOrder !== undefined) {
			updates.pendingOrder = args.pendingOrder;
		}
		if (args.pendingDelivery !== undefined) {
			updates.pendingDelivery = args.pendingDelivery;
		}
		if (args.escalationReason !== undefined) {
			updates.escalationReason = args.escalationReason;
		}
		if (args.clearPendingData) {
			updates.pendingOrder = undefined;
			updates.pendingDelivery = undefined;
		}
		if (args.clearPendingDelivery) {
			updates.pendingDelivery = undefined;
		}

		await ctx.db.patch(args.conversationId, updates);
	},
});

export const setAiProcessingState = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		isProcessing: v.boolean(),
	},
	handler: async (ctx, args) => {
		const updates: Record<string, unknown> = {
			isAiProcessing: args.isProcessing,
			updatedAt: Date.now(),
		};

		if (args.isProcessing) {
			updates.processingStartedAt = Date.now();
		} else {
			updates.processingStartedAt = undefined;
		}

		await ctx.db.patch(args.conversationId, updates);
	},
});

const PROCESSING_TIMEOUT_MS = 60_000;

export const clearStaleProcessingState = mutation({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return { success: false, error: "Conversation not found" };
		}

		if (!conversation.isAiProcessing) {
			return { success: true, alreadyCleared: true };
		}

		await ctx.db.patch(args.conversationId, {
			isAiProcessing: false,
			processingStartedAt: undefined,
			updatedAt: Date.now(),
		});

		return { success: true };
	},
});

export const autoCleanupProcessingState = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		startedAt: v.number(),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return;
		}

		if (conversation.isAiProcessing && conversation.processingStartedAt === args.startedAt) {
			await ctx.db.patch(args.conversationId, {
				isAiProcessing: false,
				processingStartedAt: undefined,
				updatedAt: Date.now(),
			});
		}
	},
});

export const scheduleProcessingCleanup = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		startedAt: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.scheduler.runAfter(
			PROCESSING_TIMEOUT_MS,
			internal.ai.process.autoCleanupProcessingState,
			{
				conversationId: args.conversationId,
				startedAt: args.startedAt,
			},
		);
	},
});

export const logAIInteraction = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		messageId: v.id("messages"),
		intent: v.object({
			type: v.string(),
			query: v.optional(v.string()),
			items: v.optional(
				v.array(
					v.object({
						productQuery: v.string(),
						quantity: v.number(),
					}),
				),
			),
			action: v.optional(v.string()),
			item: v.optional(v.string()),
			topic: v.optional(v.string()),
		}),
		prompt: v.string(),
		response: v.string(),
		model: v.string(),
		tokensUsed: v.number(),
		latencyMs: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("aiLogs", {
			conversationId: args.conversationId,
			messageId: args.messageId,
			intent: args.intent,
			prompt: args.prompt,
			response: args.response,
			model: args.model,
			tokensUsed: args.tokensUsed,
			latencyMs: args.latencyMs,
			createdAt: Date.now(),
		});
	},
});

export const storeMessage = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		content: v.string(),
		sender: v.string(),
	},
	handler: async (ctx, args): Promise<Id<"messages">> => {
		return await ctx.db.insert("messages", {
			conversationId: args.conversationId,
			content: args.content,
			sender: args.sender,
			createdAt: Date.now(),
		});
	},
});

export const notifyEscalation = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		businessId: v.id("businesses"),
		reason: v.string(),
		customerId: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.conversationId, {
			state: "escalated",
			status: "escalated",
			escalationReason: args.reason,
			updatedAt: Date.now(),
		});

		const business = await ctx.db.get(args.businessId);
		if (business) {
			await ctx.db.insert("notifications", {
				userId: business.ownerId,
				type: "escalation",
				conversationId: args.conversationId,
				read: false,
				createdAt: Date.now(),
			});
		}
	},
});

export const getOrderDetails = internalQuery({
	args: {
		orderId: v.id("orders"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.orderId);
	},
});

export const processMessage = action({
	args: {
		conversationId: v.id("conversations"),
		message: v.string(),
	},
	handler: async (ctx, args): Promise<ProcessMessageResult> => {
		const startTime = Date.now();

		const context = await ctx.runQuery(internal.ai.process.loadContext, {
			conversationId: args.conversationId,
		});

		if (!context) {
			throw new Error("Conversation or business not found");
		}

		const { conversation, business, products, messages, customerContext } = context;

		if (conversation.state === "escalated") {
			const messageId = await ctx.runMutation(internal.ai.process.storeMessage, {
				conversationId: args.conversationId,
				content: getEscalatedConversationResponse(conversation.detectedLanguage ?? "en"),
				sender: "business",
			});

			return {
				response: getEscalatedConversationResponse(conversation.detectedLanguage ?? "en"),
				intent: { type: "unknown" },
				shouldEscalate: true,
				detectedLanguage: conversation.detectedLanguage ?? "en",
				messageId,
			};
		}

		let detectedLanguage = conversation.detectedLanguage ?? "en";
		const isFirstMessage = messages.length === 0;
		let languageTokens = 0;

		if (isFirstMessage || !conversation.detectedLanguage) {
			const languageResult = await ctx.runAction(api.ai.language.detectLanguage, {
				message: args.message,
			});
			detectedLanguage = languageResult.language;
			languageTokens = languageResult.tokensUsed;

			await ctx.runMutation(internal.ai.process.updateConversation, {
				conversationId: args.conversationId,
				detectedLanguage,
			});
		}

		const productNames = products
			.filter((p: Doc<"products">) => p.available)
			.map((p: Doc<"products">) => p.name);

		const conversationHistory: Message[] = messages.map((msg: Doc<"messages">) => ({
			role: msg.sender === "customer" ? "user" : "assistant",
			content: msg.content,
		}));

		const intentResult = await ctx.runAction(api.ai.intent.classifyIntent, {
			message: args.message,
			conversationHistory,
			productNames,
		});
		const intent = intentResult.intents[0] ?? { type: "unknown" as const };
		const intentTokens = intentResult.tokensUsed;

		const failureCount = 0;
		const escalationResult = detectEscalation(args.message, conversationHistory, failureCount);

		const shouldEscalate = escalationResult.shouldEscalate || intent.type === "escalation_request";

		const businessContext = {
			name: business.name,
			type: business.type,
			description: business.description,
			address: business.address,
			timezone: business.timezone,
			businessHours: business.businessHours,
			aiTone: business.aiTone,
		};

		const productContext = products.map((p: Doc<"products">) => ({
			name: p.name,
			price: p.price,
			currency: p.currency,
			description: p.description,
			available: p.available,
			externalProductId: p.externalProductId,
		}));

		let newState = determineNewState(intent, conversation.state ?? "idle");

		const orderUpdate = handleOrderIntent(intent, conversation.pendingOrder, products);

		const checkoutResult = await handleCheckoutIntent(
			ctx,
			intent,
			conversation,
			conversation.state ?? "idle",
		);

		const responseResult = await ctx.runAction(api.ai.response.generateResponse, {
			intent: serializeIntent(intent),
			conversationHistory,
			businessContext,
			products: productContext,
			language: detectedLanguage,
			conversationState: conversation.state ?? "idle",
			checkoutContext: checkoutResult.orderId
				? {
						orderNumber: checkoutResult.orderNumber,
						paymentLink: checkoutResult.paymentLink,
						paymentMethod: intent.type === "payment_choice" ? intent.paymentMethod : undefined,
					}
				: conversation.pendingOrder
					? {
							pendingOrderSummary: conversation.pendingOrder.items
								.map(
									(item: { quantity: number; productQuery: string }) =>
										`${item.quantity}x ${item.productQuery}`,
								)
								.join(", "),
							pendingOrderTotal: conversation.pendingOrder.total,
						}
					: undefined,
			customerContext: customerContext ?? undefined,
		});
		const response = responseResult.response;
		const responseTokens = responseResult.tokensUsed;

		if (shouldEscalate) {
			newState = "escalated";
			await ctx.runMutation(internal.ai.process.notifyEscalation, {
				conversationId: args.conversationId,
				businessId: conversation.businessId,
				reason: escalationResult.reason || "Customer requested human assistance",
				customerId: conversation.customerId,
			});
		} else if (checkoutResult.orderId) {
			await ctx.runMutation(internal.ai.process.updateConversation, {
				conversationId: args.conversationId,
				state: newState,
				clearPendingData: true,
			});
		} else if (checkoutResult.pendingDelivery) {
			await ctx.runMutation(internal.ai.process.updateConversation, {
				conversationId: args.conversationId,
				state: newState,
				pendingDelivery: checkoutResult.pendingDelivery,
			});
		} else if (newState !== conversation.state || orderUpdate.pendingOrder !== undefined) {
			const isReturningToOrdering =
				newState === "ordering" &&
				(conversation.state === "confirming" || conversation.state === "payment");

			await ctx.runMutation(internal.ai.process.updateConversation, {
				conversationId: args.conversationId,
				state: newState,
				pendingOrder: orderUpdate.pendingOrder,
				clearPendingDelivery: isReturningToOrdering,
			});
		}

		const messageId = await ctx.runMutation(internal.ai.process.storeMessage, {
			conversationId: args.conversationId,
			content: response,
			sender: "business",
		});

		const latencyMs = Date.now() - startTime;

		const totalTokensUsed = languageTokens + intentTokens + responseTokens;

		await ctx.runMutation(internal.ai.process.logAIInteraction, {
			conversationId: args.conversationId,
			messageId,
			intent: serializeIntent(intent),
			prompt: `Message: ${args.message}`,
			response,
			model: "gpt-4o-mini",
			tokensUsed: totalTokensUsed,
			latencyMs,
		});

		return {
			response,
			intent,
			shouldEscalate,
			detectedLanguage,
			messageId,
		};
	},
});

function determineNewState(intent: Intent, currentState: string): string {
	const checkoutStates = ["confirming", "payment"];

	switch (intent.type) {
		case "order_start":
			return "ordering";
		case "order_modify":
			if (currentState === "idle" || checkoutStates.includes(currentState)) {
				return "ordering";
			}
			return currentState;
		case "product_question":
			if (currentState === "idle") {
				return "browsing";
			}
			return currentState;
		case "escalation_request":
			return "escalated";
		case "order_confirm":
			if (currentState === "ordering") {
				return "confirming";
			}
			return currentState;
		case "delivery_choice":
			if (currentState === "confirming") {
				const isComplete =
					intent.deliveryType === "pickup" ||
					(intent.deliveryType === "delivery" && intent.address);
				return isComplete ? "payment" : currentState;
			}
			return currentState;
		case "address_provided":
			if (currentState === "confirming") {
				return "payment";
			}
			return currentState;
		case "payment_choice":
			if (currentState === "payment") {
				return "completed";
			}
			return currentState;
		default:
			return currentState;
	}
}

interface PendingOrderItem {
	productQuery: string;
	quantity: number;
	productId?: Id<"products">;
	price?: number;
}

interface PendingOrder {
	items: PendingOrderItem[];
	total?: number;
}

interface OrderUpdateResult {
	pendingOrder?: PendingOrder;
	message?: string;
}

interface PendingDelivery {
	type: "pickup" | "delivery";
	address?: string;
}

interface CheckoutResult {
	pendingDelivery?: PendingDelivery;
	orderId?: Id<"orders">;
	orderNumber?: string;
	paymentLink?: string;
	error?: string;
}

function handleOrderIntent(
	intent: Intent,
	currentOrder: PendingOrder | undefined,
	products: Doc<"products">[],
): OrderUpdateResult {
	if (intent.type === "order_start") {
		const newItems = intent.items.map((item) => {
			const matchedProduct = findMatchingProduct(item.productQuery, products);
			return {
				productQuery: item.productQuery,
				quantity: item.quantity,
				productId: matchedProduct?._id,
				price: matchedProduct?.price,
			};
		});

		const total = calculateOrderTotal(newItems);

		return {
			pendingOrder: {
				items: newItems,
				total,
			},
		};
	}

	if (intent.type === "order_modify") {
		const items = currentOrder?.items ?? [];

		if (intent.action === "add") {
			const matchedProduct = findMatchingProduct(intent.item, products);
			const existingIndex = items.findIndex(
				(i) => i.productQuery.toLowerCase() === intent.item.toLowerCase(),
			);

			let newItems: PendingOrderItem[];
			if (existingIndex >= 0) {
				newItems = items.map((item, idx) =>
					idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
				);
			} else {
				newItems = [
					...items,
					{
						productQuery: intent.item,
						quantity: 1,
						productId: matchedProduct?._id,
						price: matchedProduct?.price,
					},
				];
			}

			return {
				pendingOrder: {
					items: newItems,
					total: calculateOrderTotal(newItems),
				},
			};
		}

		if (intent.action === "remove") {
			const existingIndex = items.findIndex((i) =>
				i.productQuery.toLowerCase().includes(intent.item.toLowerCase()),
			);

			if (existingIndex === -1) {
				return { message: `"${intent.item}" is not in your order.` };
			}

			const newItems = items.filter((_, idx) => idx !== existingIndex);
			return {
				pendingOrder: {
					items: newItems,
					total: calculateOrderTotal(newItems),
				},
			};
		}

		if (intent.action === "change_quantity") {
			return { pendingOrder: currentOrder };
		}
	}

	return {};
}

async function handleCheckoutIntent(
	ctx: ActionCtx,
	intent: Intent,
	conversation: Doc<"conversations">,
	currentState: string,
): Promise<CheckoutResult> {
	if (intent.type === "delivery_choice") {
		const isComplete =
			intent.deliveryType === "pickup" || (intent.deliveryType === "delivery" && intent.address);

		if (!isComplete) {
			return {
				pendingDelivery: {
					type: "delivery",
					address: undefined,
				},
			};
		}

		return {
			pendingDelivery: {
				type: intent.deliveryType,
				address: intent.address,
			},
		};
	}

	if (intent.type === "address_provided" && currentState === "confirming") {
		return {
			pendingDelivery: {
				type: "delivery",
				address: intent.address,
			},
		};
	}

	if (intent.type === "payment_choice" && currentState === "payment") {
		const pendingOrder = conversation.pendingOrder;
		const pendingDelivery = conversation.pendingDelivery;

		if (!pendingOrder || pendingOrder.items.length === 0) {
			return { error: "No items in order" };
		}

		const validItems = pendingOrder.items.filter(
			(item): item is typeof item & { productId: Id<"products"> } => item.productId !== undefined,
		);

		if (validItems.length === 0) {
			return { error: "No valid products in order" };
		}

		try {
			const orderId = await ctx.runMutation(api.orders.mutations.create, {
				businessId: conversation.businessId,
				conversationId: conversation._id,
				items: validItems.map((item) => ({
					productId: item.productId,
					quantity: item.quantity,
				})),
				contactPhone: conversation.customerId,
			});

			if (pendingDelivery) {
				await ctx.runMutation(api.orders.delivery.setDeliveryInfo, {
					orderId,
					deliveryType: pendingDelivery.type,
					deliveryAddress: pendingDelivery.address,
					contactPhone: conversation.customerId,
				});
			}

			await ctx.runMutation(api.orders.delivery.setPaymentMethod, {
				orderId,
				paymentMethod: intent.paymentMethod,
			});

			let paymentLink: string | undefined;
			if (intent.paymentMethod === "card") {
				paymentLink = await ctx.runAction(api.orders.payments.generatePaymentLink, {
					orderId,
				});
			}

			const order = await ctx.runQuery(internal.ai.process.getOrderDetails, {
				orderId,
			});

			return {
				orderId,
				orderNumber: order?.orderNumber,
				paymentLink,
			};
		} catch (error) {
			console.error("Checkout error:", error);
			return {
				error: error instanceof Error ? error.message : "Failed to create order",
			};
		}
	}

	return {};
}

function findMatchingProduct(
	query: string,
	products: Doc<"products">[],
): Doc<"products"> | undefined {
	const normalizedQuery = query.toLowerCase();

	const exactMatch = products.find((p) => p.available && p.name.toLowerCase() === normalizedQuery);
	if (exactMatch) return exactMatch;

	const partialMatch = products.find(
		(p) => p.available && p.name.toLowerCase().includes(normalizedQuery),
	);
	if (partialMatch) return partialMatch;

	const reverseMatch = products.find(
		(p) => p.available && normalizedQuery.includes(p.name.toLowerCase()),
	);
	return reverseMatch;
}

function calculateOrderTotal(items: PendingOrderItem[]): number {
	return items.reduce((sum, item) => {
		const price = item.price ?? 0;
		return sum + price * item.quantity;
	}, 0);
}

function getEscalatedConversationResponse(language: string): string {
	const responses: Record<string, string> = {
		en: "This conversation has been escalated to a human agent. A team member will respond shortly. Thank you for your patience.",
		es: "Esta conversación ha sido escalada a un agente humano. Un miembro del equipo responderá pronto. Gracias por su paciencia.",
		pt: "Esta conversa foi escalada para um agente humano. Um membro da equipe responderá em breve. Obrigado pela paciência.",
	};
	return responses[language] ?? responses.en ?? "";
}

export const getLastCustomerMessage = internalQuery({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args): Promise<string | null> => {
		const lastMessage = await ctx.db
			.query("messages")
			.withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
			.order("desc")
			.filter((q) => q.eq(q.field("sender"), "customer"))
			.first();

		return lastMessage?.content ?? null;
	},
});

export const retryAiProcessing = action({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		await ctx.runMutation(internal.ai.process.setAiProcessingState, {
			conversationId: args.conversationId,
			isProcessing: false,
		});

		const lastMessage = await ctx.runQuery(internal.ai.process.getLastCustomerMessage, {
			conversationId: args.conversationId,
		});

		if (!lastMessage) {
			return { success: false, error: "No customer message found to retry" };
		}

		await ctx.runMutation(internal.ai.process.setAiProcessingState, {
			conversationId: args.conversationId,
			isProcessing: true,
		});

		try {
			await ctx.runAction(api.ai.process.processMessage, {
				conversationId: args.conversationId,
				message: lastMessage,
			});

			await ctx.runMutation(internal.ai.process.setAiProcessingState, {
				conversationId: args.conversationId,
				isProcessing: false,
			});

			return { success: true };
		} catch (error) {
			await ctx.runMutation(internal.ai.process.setAiProcessingState, {
				conversationId: args.conversationId,
				isProcessing: false,
			});

			return {
				success: false,
				error: error instanceof Error ? error.message : "AI processing failed",
			};
		}
	},
});

/**
 * Process incoming message and send AI response
 * This action orchestrates: AI generation → storage → sending
 * Used by webhook handlers via ctx.scheduler for non-blocking processing
 */
export const processAndRespond = internalAction({
	args: {
		conversationId: v.id("conversations"),
		message: v.string(),
		channel: v.union(v.literal("whatsapp"), v.literal("instagram"), v.literal("messenger")),
	},
	handler: async (ctx, args) => {
		try {
			// 1. Set processing state
			await ctx.runMutation(internal.ai.process.setAiProcessingState, {
				conversationId: args.conversationId,
				isProcessing: true,
			});

			// 2. Generate AI response (this also stores the message internally)
			const aiResult = await ctx.runAction(api.ai.process.processMessage, {
				conversationId: args.conversationId,
				message: args.message,
			});

			// 3. Send response to customer based on channel
			if (args.channel === "whatsapp") {
				await ctx.runAction(api.integrations.whatsapp.actions.sendMessage, {
					messageId: aiResult.messageId,
					conversationId: args.conversationId,
					content: aiResult.response,
					type: "text",
				});
			} else {
				// Meta (Instagram/Messenger)
				await ctx.runAction(api.integrations.meta.actions.sendMessage, {
					messageId: aiResult.messageId,
					conversationId: args.conversationId,
					content: aiResult.response,
					type: "text",
				});
			}

			// 4. Clear processing state
			await ctx.runMutation(internal.ai.process.setAiProcessingState, {
				conversationId: args.conversationId,
				isProcessing: false,
			});
		} catch (error) {
			// Clear processing state on error
			await ctx.runMutation(internal.ai.process.setAiProcessingState, {
				conversationId: args.conversationId,
				isProcessing: false,
			});

			console.error(`[processAndRespond] Failed for conversation ${args.conversationId}:`, error);

			// Retry on rate limit errors
			if (error instanceof Error && error.message.includes("429")) {
				await ctx.scheduler.runAfter(30000, internal.ai.process.processAndRespond, args);
			} else {
				// For other errors, log but don't retry automatically
				throw error;
			}
		}
	},
});
