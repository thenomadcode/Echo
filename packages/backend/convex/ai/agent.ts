import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { buildAgentPrompt } from "./agentPrompt";
import type { CustomerContext, LanguageCode, OrderItem, OrderState } from "./agentPrompt";
import { OpenAIProvider } from "./providers/openai";
import { CUSTOMER_TOOLS, ORDER_TOOLS } from "./tools";
import type {
	AddCustomerNoteArgs,
	CancelOrderArgs,
	CreateDeletionRequestArgs,
	EscalateArgs,
	SaveCustomerAddressArgs,
	SaveCustomerPreferenceArgs,
	SetDeliveryArgs,
	SubmitOrderArgs,
	ToolCall,
	UpdateOrderArgs,
} from "./tools";

interface AgentContext {
	conversation: Doc<"conversations">;
	business: Doc<"businesses">;
	products: (Doc<"products"> & { variants: Doc<"productVariants">[] })[];
	messages: Doc<"messages">[];
	customerContext: CustomerContext | null;
}

interface ToolExecutionResult {
	success: boolean;
	message: string;
	data?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionContext = any;

export const loadAgentContext = internalQuery({
	args: {
		conversationId: v.id("conversations"),
	},
	handler: async (ctx, args): Promise<AgentContext | null> => {
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) return null;

		const business = await ctx.db.get(conversation.businessId);
		if (!business) return null;

		const productsQuery = await ctx.db
			.query("products")
			.withIndex("by_business", (q) =>
				q.eq("businessId", conversation.businessId as unknown as string).eq("deleted", false),
			)
			.collect();

		const productsWithVariants = await Promise.all(
			productsQuery.map(async (product) => {
				const variants = await ctx.db
					.query("productVariants")
					.withIndex("by_product", (q) => q.eq("productId", product._id))
					.filter((q) => q.eq(q.field("available"), true))
					.collect();

				return {
					...product,
					variants: variants.sort((a, b) => a.position - b.position),
				};
			}),
		);

		const products = productsWithVariants;

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

export const updateOrderState = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		pendingOrder: v.optional(
			v.object({
				items: v.array(
					v.object({
						productQuery: v.string(),
						quantity: v.number(),
						productId: v.optional(v.id("products")),
						variantId: v.optional(v.id("productVariants")),
						price: v.optional(v.number()),
					}),
				),
				total: v.optional(v.number()),
			}),
		),
		pendingDelivery: v.optional(
			v.object({
				type: v.union(v.literal("pickup"), v.literal("delivery")),
				address: v.optional(v.string()),
			}),
		),
		state: v.optional(v.string()),
		clearOrder: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const updates: Record<string, unknown> = {
			updatedAt: Date.now(),
		};

		if (args.clearOrder) {
			updates.pendingOrder = undefined;
			updates.pendingDelivery = undefined;
			updates.state = "idle";
		} else {
			if (args.pendingOrder !== undefined) {
				updates.pendingOrder = args.pendingOrder;
			}
			if (args.pendingDelivery !== undefined) {
				updates.pendingDelivery = args.pendingDelivery;
			}
			if (args.state !== undefined) {
				updates.state = args.state;
			}
		}

		await ctx.db.patch(args.conversationId, updates);
	},
});

export const storeAgentMessage = internalMutation({
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

export const escalateConversation = internalMutation({
	args: {
		conversationId: v.id("conversations"),
		reason: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.conversationId, {
			state: "escalated",
			escalationReason: args.reason,
			updatedAt: Date.now(),
		});
	},
});

export const getOrderDetails = internalQuery({
	args: { orderId: v.id("orders") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.orderId);
	},
});

function buildOrderState(
	conversation: Doc<"conversations">,
	products: (Doc<"products"> & { variants: Doc<"productVariants">[] })[],
): OrderState | null {
	const pending = conversation.pendingOrder;
	if (!pending || pending.items.length === 0) {
		return null;
	}

	const items: OrderItem[] = pending.items.map((item) => {
		const product = products.find((p) => p._id === item.productId);
		return {
			productName: item.productQuery,
			quantity: item.quantity,
			unitPrice: item.price ?? product?.price ?? 0,
			currency: product?.currency ?? "USD",
		};
	});

	const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
	const currency = items[0]?.currency ?? "USD";

	const delivery = conversation.pendingDelivery
		? {
				type: conversation.pendingDelivery.type,
				address: conversation.pendingDelivery.address,
			}
		: undefined;

	return { items, total, currency, delivery };
}

function findProduct(
	name: string,
	products: (Doc<"products"> & { variants: Doc<"productVariants">[] })[],
): (Doc<"products"> & { variants: Doc<"productVariants">[] }) | undefined {
	const normalized = name.toLowerCase().trim();

	const exact = products.find((p) => p.available && p.name.toLowerCase() === normalized);
	if (exact) return exact;

	const partial = products.find((p) => p.available && p.name.toLowerCase().includes(normalized));
	if (partial) return partial;

	const reverse = products.find((p) => p.available && normalized.includes(p.name.toLowerCase()));
	return reverse;
}

function matchesExactVariantName(variant: Doc<"productVariants">, normalized: string): boolean {
	return variant.available && variant.name.toLowerCase() === normalized;
}

function matchesSku(variant: Doc<"productVariants">, normalized: string): boolean {
	return variant.available && variant.sku?.toLowerCase() === normalized;
}

function matchesAnyOptionValue(variant: Doc<"productVariants">, normalized: string): boolean {
	if (!variant.available) return false;

	const option1Match = !!(
		variant.option1Value && normalized.includes(variant.option1Value.toLowerCase())
	);
	const option2Match = !!(
		variant.option2Value && normalized.includes(variant.option2Value.toLowerCase())
	);
	const option3Match = !!(
		variant.option3Value && normalized.includes(variant.option3Value.toLowerCase())
	);

	return option1Match || option2Match || option3Match;
}

function matchesPartialVariantName(variant: Doc<"productVariants">, normalized: string): boolean {
	return variant.available && variant.name.toLowerCase().includes(normalized);
}

function findVariant(
	variantSpec: string,
	variants: Doc<"productVariants">[],
): Doc<"productVariants"> | undefined {
	if (!variants || variants.length === 0) {
		return undefined;
	}

	const normalized = variantSpec.toLowerCase().trim();

	const exactName = variants.find((v) => matchesExactVariantName(v, normalized));
	if (exactName) return exactName;

	const bySku = variants.find((v) => matchesSku(v, normalized));
	if (bySku) return bySku;

	const byOption = variants.find((v) => matchesAnyOptionValue(v, normalized));
	if (byOption) return byOption;

	const partialName = variants.find((v) => matchesPartialVariantName(v, normalized));
	if (partialName) return partialName;

	return undefined;
}

function getEscalatedResponse(language: string): string {
	const responses: Record<string, string> = {
		en: "This conversation has been transferred to a human agent. Someone will respond shortly. Thank you for your patience!",
		es: "Esta conversación ha sido transferida a un agente humano. Alguien responderá pronto. ¡Gracias por tu paciencia!",
		pt: "Esta conversa foi transferida para um agente humano. Alguém responderá em breve. Obrigado pela paciência!",
	};
	return responses[language] ?? responses.en ?? "";
}

interface ProcessWithAgentResult {
	response: string;
	toolsUsed: string[];
}

export const processWithAgent = action({
	args: {
		conversationId: v.id("conversations"),
		message: v.string(),
	},
	handler: async (ctx, args): Promise<ProcessWithAgentResult> => {
		const context: AgentContext | null = await ctx.runQuery(internal.ai.agent.loadAgentContext, {
			conversationId: args.conversationId,
		});

		if (!context) {
			throw new Error("Conversation or business not found");
		}

		const { conversation, business, products, messages, customerContext }: AgentContext = context;

		if (conversation.state === "escalated") {
			return {
				response: getEscalatedResponse(conversation.detectedLanguage ?? "en"),
				toolsUsed: [] as string[],
			};
		}

		const language = (conversation.detectedLanguage ?? "en") as LanguageCode;
		const orderState = buildOrderState(conversation, products);

		const systemPrompt = buildAgentPrompt({
			business: {
				name: business.name,
				type: business.type,
				description: business.description,
				address: business.address,
				timezone: business.timezone,
				businessHours: business.businessHours,
			},
			products: products.map((p) => ({
				name: p.name,
				price: p.price,
				currency: p.currency,
				description: p.description,
				available: p.available,
				hasVariants: p.hasVariants,
				variants: p.variants?.map((v) => ({
					name: v.name,
					sku: v.sku,
					price: v.price,
					inventoryQuantity: v.inventoryQuantity,
					available: v.available,
					option1Name: v.option1Name,
					option1Value: v.option1Value,
					option2Name: v.option2Name,
					option2Value: v.option2Value,
					option3Name: v.option3Name,
					option3Value: v.option3Value,
				})),
				externalProductId: p.externalProductId,
			})),
			currentOrder: orderState,
			language,
			customerPhone: conversation.customerId,
			customerContext,
		});

		const conversationHistory = messages.map((msg: Doc<"messages">) => ({
			role: msg.sender === "customer" ? ("user" as const) : ("assistant" as const),
			content: msg.content,
		}));

		conversationHistory.push({ role: "user", content: args.message });

		const provider = new OpenAIProvider();
		const result = await provider.completeWithTools({
			messages: conversationHistory,
			systemPrompt,
			tools: [...ORDER_TOOLS, ...CUSTOMER_TOOLS],
			temperature: 0.7,
		});

		const toolResults: string[] = [];

		for (const toolCall of result.toolCalls) {
			const execResult = await executeToolCall(ctx, toolCall, conversation, products);
			toolResults.push(`${toolCall.name}: ${execResult.message}`);
			if (execResult.data) {
				toolResults.push(JSON.stringify(execResult.data));
			}
		}

		let response = result.content ?? "";

		if (!response && toolResults.length > 0) {
			const updatedContext = await ctx.runQuery(internal.ai.agent.loadAgentContext, {
				conversationId: args.conversationId,
			});

			if (updatedContext) {
				const updatedOrderState = buildOrderState(updatedContext.conversation, products);
				const followUpPrompt = buildAgentPrompt({
					business: {
						name: business.name,
						type: business.type,
						description: business.description,
						address: business.address,
						timezone: business.timezone,
						businessHours: business.businessHours,
					},
					products: products.map((p) => ({
						name: p.name,
						price: p.price,
						currency: p.currency,
						description: p.description,
						available: p.available,
						hasVariants: p.hasVariants,
						variants: p.variants?.map((v) => ({
							name: v.name,
							sku: v.sku,
							price: v.price,
							inventoryQuantity: v.inventoryQuantity,
							available: v.available,
							option1Name: v.option1Name,
							option1Value: v.option1Value,
							option2Name: v.option2Name,
							option2Value: v.option2Value,
							option3Name: v.option3Name,
							option3Value: v.option3Value,
						})),
						externalProductId: p.externalProductId,
					})),
					currentOrder: updatedOrderState,
					language,
					customerPhone: conversation.customerId,
					customerContext: updatedContext.customerContext,
				});

				const followUp = await provider.complete({
					messages: [
						...conversationHistory,
						{
							role: "assistant",
							content: `[Tool executed: ${toolResults.join(", ")}]`,
						},
					],
					systemPrompt: `${followUpPrompt}\n\nNow respond to the customer about what just happened.`,
					temperature: 0.7,
				});

				response = followUp.content;
			}
		}

		await ctx.runMutation(internal.ai.agent.storeAgentMessage, {
			conversationId: args.conversationId,
			content: response,
			sender: "business",
		});

		return {
			response,
			toolsUsed: result.toolCalls.map((tc) => tc.name),
		};
	},
});

async function executeToolCall(
	ctx: ActionContext,
	toolCall: ToolCall,
	conversation: Doc<"conversations">,
	products: (Doc<"products"> & { variants: Doc<"productVariants">[] })[],
): Promise<ToolExecutionResult> {
	switch (toolCall.name) {
		case "update_order":
			return executeUpdateOrder(
				ctx,
				toolCall.arguments as unknown as UpdateOrderArgs,
				conversation,
				products,
			);
		case "set_delivery":
			return executeSetDelivery(
				ctx,
				toolCall.arguments as unknown as SetDeliveryArgs,
				conversation,
			);
		case "submit_order":
			return executeSubmitOrder(
				ctx,
				toolCall.arguments as unknown as SubmitOrderArgs,
				conversation,
			);
		case "cancel_order":
			return executeCancelOrder(
				ctx,
				toolCall.arguments as unknown as CancelOrderArgs,
				conversation,
			);
		case "escalate_to_human":
			return executeEscalate(ctx, toolCall.arguments as unknown as EscalateArgs, conversation);
		case "create_deletion_request":
			return executeCreateDeletionRequest(
				ctx,
				toolCall.arguments as unknown as CreateDeletionRequestArgs,
				conversation,
			);
		case "save_customer_preference":
			return executeSaveCustomerPreference(
				ctx,
				toolCall.arguments as unknown as SaveCustomerPreferenceArgs,
				conversation,
			);
		case "save_customer_address":
			return executeSaveCustomerAddress(
				ctx,
				toolCall.arguments as unknown as SaveCustomerAddressArgs,
				conversation,
			);
		case "add_customer_note":
			return executeAddCustomerNote(
				ctx,
				toolCall.arguments as unknown as AddCustomerNoteArgs,
				conversation,
			);
		default:
			return { success: false, message: `Unknown tool: ${toolCall.name}` };
	}
}

async function executeUpdateOrder(
	ctx: ActionContext,
	args: UpdateOrderArgs,
	conversation: Doc<"conversations">,
	products: (Doc<"products"> & { variants: Doc<"productVariants">[] })[],
): Promise<ToolExecutionResult> {
	const currentItems = conversation.pendingOrder?.items ?? [];

	if (args.action === "clear") {
		await ctx.runMutation(internal.ai.agent.updateOrderState, {
			conversationId: conversation._id,
			clearOrder: true,
		});
		return { success: true, message: "Order cleared" };
	}

	if (!args.items || args.items.length === 0) {
		return { success: false, message: "No items specified" };
	}

	const newItems = [...currentItems];

	for (const item of args.items) {
		const product = findProduct(item.product_name, products);

		if (args.action === "add") {
			if (!product) {
				return {
					success: false,
					message: `Product "${item.product_name}" not found`,
				};
			}

			let selectedVariant: Doc<"productVariants"> | undefined;
			let selectedPrice = product.price;
			let selectedVariantName: string | undefined;

			if (product.hasVariants && product.variants.length > 0) {
				if (item.variant_specification) {
					selectedVariant = findVariant(item.variant_specification, product.variants);

					if (!selectedVariant) {
						const availableOptions = product.variants
							.filter((v) => v.available)
							.map((v) => v.name)
							.join(", ");
						return {
							success: false,
							message: `Variant "${item.variant_specification}" not found for ${product.name}. Available: ${availableOptions}`,
						};
					}

					selectedPrice = selectedVariant.price;
					selectedVariantName = selectedVariant.name;
				} else {
					const availableOptions = product.variants
						.filter((v) => v.available)
						.map((v) => v.name)
						.join(", ");
					return {
						success: false,
						message: `Product "${product.name}" has variants. Please specify which one: ${availableOptions}`,
					};
				}
			}

			const existingIdx = selectedVariant
				? newItems.findIndex(
						(i) => i.productId === product._id && i.variantId === selectedVariant._id,
					)
				: newItems.findIndex((i) => i.productId === product._id && !i.variantId);

			const qty = item.quantity ?? 1;

			if (existingIdx >= 0) {
				const existing = newItems[existingIdx];
				if (existing) {
					newItems[existingIdx] = {
						...existing,
						quantity: existing.quantity + qty,
					};
				}
			} else {
				newItems.push({
					productQuery: selectedVariantName
						? `${product.name} (${selectedVariantName})`
						: product.name,
					quantity: qty,
					productId: product._id,
					variantId: selectedVariant?._id,
					price: selectedPrice,
				});
			}
		} else if (args.action === "remove") {
			const idx = newItems.findIndex(
				(i) =>
					i.productQuery.toLowerCase().includes(item.product_name.toLowerCase()) ||
					(product && i.productId === product._id),
			);
			if (idx >= 0) {
				newItems.splice(idx, 1);
			}
		} else if (args.action === "set_quantity") {
			const idx = newItems.findIndex(
				(i) =>
					i.productQuery.toLowerCase().includes(item.product_name.toLowerCase()) ||
					(product && i.productId === product._id),
			);
			if (idx >= 0 && item.quantity !== undefined) {
				const existing = newItems[idx];
				if (item.quantity <= 0) {
					newItems.splice(idx, 1);
				} else if (existing) {
					newItems[idx] = { ...existing, quantity: item.quantity };
				}
			}
		}
	}

	const total = newItems.reduce((sum, item) => {
		return sum + (item.price ?? 0) * item.quantity;
	}, 0);

	await ctx.runMutation(internal.ai.agent.updateOrderState, {
		conversationId: conversation._id,
		pendingOrder: { items: newItems, total },
		state: newItems.length > 0 ? "ordering" : "idle",
	});

	return {
		success: true,
		message: `Order updated: ${newItems.length} item(s)`,
		data: { itemCount: newItems.length, total },
	};
}

async function executeSetDelivery(
	ctx: ActionContext,
	args: SetDeliveryArgs,
	conversation: Doc<"conversations">,
): Promise<ToolExecutionResult> {
	if (args.type === "delivery" && !args.address) {
		await ctx.runMutation(internal.ai.agent.updateOrderState, {
			conversationId: conversation._id,
			pendingDelivery: { type: "delivery", address: undefined },
		});
		return {
			success: true,
			message: "Delivery selected, waiting for address",
		};
	}

	await ctx.runMutation(internal.ai.agent.updateOrderState, {
		conversationId: conversation._id,
		pendingDelivery: {
			type: args.type,
			address: args.address,
		},
	});

	return {
		success: true,
		message: args.type === "pickup" ? "Pickup selected" : `Delivery to ${args.address}`,
	};
}

async function executeSubmitOrder(
	ctx: ActionContext,
	args: SubmitOrderArgs,
	conversation: Doc<"conversations">,
): Promise<ToolExecutionResult> {
	if (!args.customer_confirmed) {
		return {
			success: false,
			message: "Customer has not confirmed the order",
		};
	}

	const pending = conversation.pendingOrder;
	const delivery = conversation.pendingDelivery;

	if (!pending || pending.items.length === 0) {
		return { success: false, message: "No items in order" };
	}

	if (!delivery) {
		return { success: false, message: "Delivery preference not set" };
	}

	if (delivery.type === "delivery" && !delivery.address) {
		return { success: false, message: "Delivery address required" };
	}

	const validItems = pending.items.filter(
		(item): item is typeof item & { productId: Id<"products"> } => item.productId !== undefined,
	);

	if (validItems.length === 0) {
		return { success: false, message: "No valid products in order" };
	}

	try {
		const orderId = await ctx.runMutation(api.orders.mutations.create, {
			businessId: conversation.businessId,
			conversationId: conversation._id,
			items: validItems.map((item) => ({
				productId: item.productId,
				variantId: item.variantId,
				quantity: item.quantity,
			})),
			contactPhone: conversation.customerId,
		});

		await ctx.runMutation(api.orders.delivery.setDeliveryInfo, {
			orderId,
			deliveryType: delivery.type,
			deliveryAddress: delivery.address,
			contactPhone: conversation.customerId,
		});

		await ctx.runMutation(api.orders.delivery.setPaymentMethod, {
			orderId,
			paymentMethod: args.payment_method,
		});

		let paymentLink: string | undefined;
		if (args.payment_method === "card") {
			paymentLink = await ctx.runAction(api.orders.payments.generatePaymentLink, {
				orderId,
			});
		}

		const order = await ctx.runQuery(internal.ai.agent.getOrderDetails, {
			orderId,
		});

		await ctx.runMutation(internal.ai.agent.updateOrderState, {
			conversationId: conversation._id,
			clearOrder: true,
		});

		await ctx.runMutation(internal.ai.agent.updateOrderState, {
			conversationId: conversation._id,
			state: "completed",
		});

		return {
			success: true,
			message: "Order submitted successfully",
			data: {
				orderNumber: order?.orderNumber,
				paymentMethod: args.payment_method,
				paymentLink,
			},
		};
	} catch (error) {
		return {
			success: false,
			message: error instanceof Error ? error.message : "Failed to create order",
		};
	}
}

async function executeCancelOrder(
	ctx: ActionContext,
	_args: CancelOrderArgs,
	conversation: Doc<"conversations">,
): Promise<ToolExecutionResult> {
	await ctx.runMutation(internal.ai.agent.updateOrderState, {
		conversationId: conversation._id,
		clearOrder: true,
	});

	return { success: true, message: "Order cancelled" };
}

async function executeEscalate(
	ctx: ActionContext,
	args: EscalateArgs,
	conversation: Doc<"conversations">,
): Promise<ToolExecutionResult> {
	await ctx.runMutation(internal.ai.agent.escalateConversation, {
		conversationId: conversation._id,
		reason: args.reason,
	});

	return { success: true, message: "Escalated to human" };
}

async function executeCreateDeletionRequest(
	ctx: ActionContext,
	args: CreateDeletionRequestArgs,
	conversation: Doc<"conversations">,
): Promise<ToolExecutionResult> {
	if (!args.confirmed) {
		return {
			success: false,
			message: "Customer has not confirmed deletion. Ask them to confirm first.",
		};
	}

	if (!conversation.customerRecordId) {
		return {
			success: false,
			message: "No customer record linked to this conversation",
		};
	}

	const result = await ctx.runAction(api.ai.customerHistory.createDeletionRequest, {
		customerId: conversation.customerRecordId,
		conversationId: conversation._id,
	});

	return {
		success: result.success,
		message: result.message,
	};
}

async function executeSaveCustomerPreference(
	ctx: ActionContext,
	args: SaveCustomerPreferenceArgs,
	conversation: Doc<"conversations">,
): Promise<ToolExecutionResult> {
	if (!conversation.customerRecordId) {
		return {
			success: false,
			message: "No customer record linked to this conversation",
		};
	}

	const result = await ctx.runAction(api.ai.customerHistory.saveCustomerPreference, {
		customerId: conversation.customerRecordId as Id<"customers">,
		category: args.category,
		fact: args.fact,
		conversationId: conversation._id as Id<"conversations">,
	});

	if (result.status === "already_exists") {
		return {
			success: true,
			message: `This ${args.category} was already recorded`,
		};
	}

	return {
		success: true,
		message: `Saved ${args.category}: ${args.fact}`,
	};
}

async function executeSaveCustomerAddress(
	ctx: ActionContext,
	args: SaveCustomerAddressArgs,
	conversation: Doc<"conversations">,
): Promise<ToolExecutionResult> {
	if (!conversation.customerRecordId) {
		return {
			success: false,
			message: "No customer record linked to this conversation",
		};
	}

	const result = await ctx.runAction(api.ai.customerHistory.updateCustomerAddress, {
		customerId: conversation.customerRecordId as Id<"customers">,
		address: args.address,
		label: args.label,
		setAsDefault: args.set_as_default,
		conversationId: conversation._id as Id<"conversations">,
	});

	return {
		success: true,
		message: result.isNew
			? `Saved new address: ${args.address}`
			: `Updated existing address: ${args.address}`,
	};
}

async function executeAddCustomerNote(
	ctx: ActionContext,
	args: AddCustomerNoteArgs,
	conversation: Doc<"conversations">,
): Promise<ToolExecutionResult> {
	if (!conversation.customerRecordId) {
		return {
			success: false,
			message: "No customer record linked to this conversation",
		};
	}

	const result = await ctx.runAction(api.ai.customerHistory.addCustomerNote, {
		customerId: conversation.customerRecordId as Id<"customers">,
		note: args.note,
		conversationId: conversation._id as Id<"conversations">,
	});

	return {
		success: result.success,
		message: result.message,
	};
}
