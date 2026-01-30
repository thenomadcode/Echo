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

interface ProductWithVariants {
	product: Doc<"products">;
	variants: Doc<"productVariants">[];
}

interface AgentContext {
	conversation: Doc<"conversations">;
	business: Doc<"businesses">;
	productsWithVariants: ProductWithVariants[];
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

		const products = await ctx.db
			.query("products")
			.withIndex("by_business", (q) =>
				q.eq("businessId", conversation.businessId as unknown as string).eq("deleted", false),
			)
			.collect();

		const productsWithVariants: ProductWithVariants[] = await Promise.all(
			products.map(async (product) => {
				const variants = await ctx.db
					.query("productVariants")
					.withIndex("by_product", (q) => q.eq("productId", product._id))
					.collect();
				return { product, variants };
			}),
		);

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
			productsWithVariants,
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
		partialVariantSelection: v.optional(
			v.object({
				productId: v.id("products"),
				selectedOptions: v.object({}),
			}),
		),
		state: v.optional(v.string()),
		clearOrder: v.optional(v.boolean()),
		clearPartialVariant: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const updates: Record<string, unknown> = {
			updatedAt: Date.now(),
		};

		if (args.clearOrder) {
			updates.pendingOrder = undefined;
			updates.pendingDelivery = undefined;
			updates.partialVariantSelection = undefined;
			updates.state = "idle";
		} else {
			if (args.pendingOrder !== undefined) {
				updates.pendingOrder = args.pendingOrder;
			}
			if (args.pendingDelivery !== undefined) {
				updates.pendingDelivery = args.pendingDelivery;
			}
			if (args.partialVariantSelection !== undefined) {
				updates.partialVariantSelection = args.partialVariantSelection;
			}
			if (args.clearPartialVariant) {
				updates.partialVariantSelection = undefined;
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
	products: Doc<"products">[],
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

function findProduct(name: string, products: Doc<"products">[]): Doc<"products"> | undefined {
	const normalized = name.toLowerCase().trim();

	const exact = products.find((p) => p.available && p.name.toLowerCase() === normalized);
	if (exact) return exact;

	const partial = products.find((p) => p.available && p.name.toLowerCase().includes(normalized));
	if (partial) return partial;

	const reverse = products.find((p) => p.available && normalized.includes(p.name.toLowerCase()));
	return reverse;
}

function getEscalatedResponse(language: string): string {
	const responses: Record<string, string> = {
		en: "This conversation has been transferred to a human agent. Someone will respond shortly. Thank you for your patience!",
		es: "Esta conversación ha sido transferida a un agente humano. Alguien responderá pronto. ¡Gracias por tu paciencia!",
		pt: "Esta conversa foi transferida para um agente humano. Alguém responderá em breve. Obrigado pela paciência!",
	};
	return responses[language] ?? responses.en ?? "";
}

function formatPriceForAI(cents: number, currency: string): string {
	const amount = cents / 100;
	const symbols: Record<string, string> = {
		USD: "$",
		COP: "COP $",
		BRL: "R$",
		MXN: "MX$",
	};
	return `${symbols[currency] ?? currency}${amount.toFixed(2)}`;
}

function extractVariantOptions(variant: Doc<"productVariants">): Record<string, string> {
	const options: Record<string, string> = {};
	if (variant.option1Name && variant.option1Value) {
		options[variant.option1Name.toLowerCase()] = variant.option1Value;
	}
	if (variant.option2Name && variant.option2Value) {
		options[variant.option2Name.toLowerCase()] = variant.option2Value;
	}
	if (variant.option3Name && variant.option3Value) {
		options[variant.option3Name.toLowerCase()] = variant.option3Value;
	}
	return options;
}

function transformProductsForAI(
	productsWithVariants: ProductWithVariants[],
	businessCurrency: string,
) {
	return productsWithVariants.map(({ product, variants }) => ({
		id: product._id,
		name: product.name,
		description: product.description,
		hasVariants: product.hasVariants ?? false,
		variants: variants.map((variant) => ({
			id: variant._id,
			name: variant.name,
			price: formatPriceForAI(variant.price, businessCurrency),
			sku: variant.sku,
			inventoryQuantity: variant.inventoryQuantity,
			available: variant.available,
			options: extractVariantOptions(variant),
		})),
	}));
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

		const {
			conversation,
			business,
			productsWithVariants,
			messages,
			customerContext,
		}: AgentContext = context;

		if (conversation.state === "escalated") {
			return {
				response: getEscalatedResponse(conversation.detectedLanguage ?? "en"),
				toolsUsed: [] as string[],
			};
		}

		const products = productsWithVariants.map((p) => p.product);
		const language = (conversation.detectedLanguage ?? "en") as LanguageCode;
		const orderState = buildOrderState(conversation, products);

		const currency =
			business.defaultLanguage === "es" ? "COP" : business.defaultLanguage === "pt" ? "BRL" : "USD";

		const systemPrompt = buildAgentPrompt({
			business: {
				name: business.name,
				type: business.type,
				description: business.description,
				address: business.address,
				timezone: business.timezone,
				businessHours: business.businessHours,
			},
			products: transformProductsForAI(productsWithVariants, currency),
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
			const execResult = await executeToolCall(ctx, toolCall, conversation, productsWithVariants);
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
					products: transformProductsForAI(updatedContext.productsWithVariants, currency),
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
	productsWithVariants: ProductWithVariants[],
): Promise<ToolExecutionResult> {
	switch (toolCall.name) {
		case "update_order":
			return executeUpdateOrder(
				ctx,
				toolCall.arguments as unknown as UpdateOrderArgs,
				conversation,
				productsWithVariants,
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

/**
 * Fuzzy match a variant query against variant option values
 * Handles abbreviations like 'm', 'med', 'medium' → 'Medium'
 */
function fuzzyMatchVariantValue(query: string, value: string): boolean {
	const q = query.toLowerCase().trim();
	const v = value.toLowerCase().trim();

	// Exact match
	if (q === v) return true;

	// Abbreviation handling for common size names
	const sizeAbbreviations: Record<string, string[]> = {
		small: ["s", "sm", "sml"],
		medium: ["m", "med", "md"],
		large: ["l", "lg", "lrg"],
		"extra small": ["xs", "xsm"],
		"extra large": ["xl", "xlg"],
		"2x large": ["xxl", "2xl"],
		"3x large": ["xxxl", "3xl"],
	};

	for (const [fullName, abbrevs] of Object.entries(sizeAbbreviations)) {
		if (v === fullName && abbrevs.includes(q)) return true;
		if (q === fullName && abbrevs.includes(v)) return true;
	}

	// Partial match (query contains value or value contains query)
	if (v.includes(q) || q.includes(v)) return true;

	return false;
}

/**
 * Extract all variant option values from a variant
 */
function getVariantOptionValues(variant: Doc<"productVariants">): string[] {
	const values: string[] = [];
	if (variant.option1Value) values.push(variant.option1Value);
	if (variant.option2Value) values.push(variant.option2Value);
	if (variant.option3Value) values.push(variant.option3Value);
	return values;
}

/**
 * Extract option names and values from a variant as a map
 */
function getVariantOptionsMap(variant: Doc<"productVariants">): Record<string, string> {
	const options: Record<string, string> = {};
	if (variant.option1Name && variant.option1Value) {
		options[variant.option1Name.toLowerCase()] = variant.option1Value;
	}
	if (variant.option2Name && variant.option2Value) {
		options[variant.option2Name.toLowerCase()] = variant.option2Value;
	}
	if (variant.option3Name && variant.option3Value) {
		options[variant.option3Name.toLowerCase()] = variant.option3Value;
	}
	return options;
}

/**
 * Find which options are missing from a partial selection
 */
function getMissingOptions(
	variants: Doc<"productVariants">[],
	selectedOptions: Record<string, string | undefined>,
): string[] {
	if (variants.length === 0) return [];

	const firstVariant = variants[0];
	const allOptionNames: string[] = [];

	if (firstVariant.option1Name) allOptionNames.push(firstVariant.option1Name.toLowerCase());
	if (firstVariant.option2Name) allOptionNames.push(firstVariant.option2Name.toLowerCase());
	if (firstVariant.option3Name) allOptionNames.push(firstVariant.option3Name.toLowerCase());

	return allOptionNames.filter((name) => !selectedOptions[name]);
}

/**
 * Format variant for display (e.g., "Small / Red")
 */
function formatVariantDisplay(variant: Doc<"productVariants">): string {
	const values = getVariantOptionValues(variant);
	return values.length > 0 ? values.join(" / ") : variant.name || "Standard";
}

/**
 * Match a variant query to available variants with fuzzy matching
 * Returns: { matched, variantId, error, availableOptions }
 */
function matchVariantQuery(
	variantQuery: string,
	variants: Doc<"productVariants">[],
): {
	matched: boolean;
	variantId?: string;
	variantName?: string;
	price?: number;
	error?: string;
	availableOptions?: string[];
} {
	const query = variantQuery.toLowerCase().trim();
	const queryParts = query.split(/\s+/);
	const availableVariants = variants.filter((v) => v.available);

	if (availableVariants.length === 0) {
		return { matched: false, error: "No variants available for this product" };
	}

	// Try to find exact matches (all query parts match variant options)
	const exactMatches: Doc<"productVariants">[] = [];

	for (const variant of availableVariants) {
		const optionValues = getVariantOptionValues(variant);

		// Check if all query parts match option values
		const allPartsMatch = queryParts.every((part) =>
			optionValues.some((opt) => fuzzyMatchVariantValue(part, opt)),
		);

		if (allPartsMatch) {
			exactMatches.push(variant);
		}
	}

	// If exactly one match, return it
	if (exactMatches.length === 1) {
		const matched = exactMatches[0];
		if (matched) {
			return {
				matched: true,
				variantId: matched._id,
				variantName: formatVariantDisplay(matched),
				price: matched.price,
			};
		}
	}

	// If multiple exact matches, ask for clarification
	if (exactMatches.length > 1) {
		const options = exactMatches.map((v) => {
			const display = formatVariantDisplay(v);
			const priceFormatted = `$${(v.price / 100).toFixed(2)}`;
			return `${display} (${priceFormatted})`;
		});
		return {
			matched: false,
			error: `Multiple variants match "${variantQuery}". Please specify which one:`,
			availableOptions: options,
		};
	}

	// No exact match - try partial matches (at least one query part matches)
	const partialMatches: Doc<"productVariants">[] = [];

	for (const variant of availableVariants) {
		const optionValues = getVariantOptionValues(variant);

		const anyPartMatches = queryParts.some((part) =>
			optionValues.some((opt) => fuzzyMatchVariantValue(part, opt)),
		);

		if (anyPartMatches) {
			partialMatches.push(variant);
		}
	}

	// If exactly one partial match, return it
	if (partialMatches.length === 1) {
		const matched = partialMatches[0];
		if (matched) {
			return {
				matched: true,
				variantId: matched._id,
				variantName: formatVariantDisplay(matched),
				price: matched.price,
			};
		}
	}

	// If multiple partial matches, ask for clarification
	if (partialMatches.length > 1) {
		const options = partialMatches.map((v) => {
			const display = formatVariantDisplay(v);
			const priceFormatted = `$${(v.price / 100).toFixed(2)}`;
			return `${display} (${priceFormatted})`;
		});
		return {
			matched: false,
			error: `"${variantQuery}" matches multiple options. Which would you like:`,
			availableOptions: options,
		};
	}

	// No matches at all - return all available options
	const options = availableVariants.map((v) => {
		const display = formatVariantDisplay(v);
		const priceFormatted = `$${(v.price / 100).toFixed(2)}`;
		return `${display} (${priceFormatted})`;
	});
	return {
		matched: false,
		error: `"${variantQuery}" doesn't match any available options. Available:`,
		availableOptions: options,
	};
}

async function executeUpdateOrder(
	ctx: ActionContext,
	args: UpdateOrderArgs,
	conversation: Doc<"conversations">,
	productsWithVariants: ProductWithVariants[],
): Promise<ToolExecutionResult> {
	const currentItems = conversation.pendingOrder?.items ?? [];
	const products = productsWithVariants.map((p) => p.product);

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

			// Get variants for this product
			const productWithVariants = productsWithVariants.find((p) => p.product._id === product._id);
			const variants = productWithVariants?.variants ?? [];

			// Check if product has variants
			if (product.hasVariants && variants.length > 1) {
				// Product has variants - need variant specification
				let variantQuery = item.variant_query;

				// Check if we have a partial selection for this product
				const hasPartialSelection =
					conversation.partialVariantSelection !== undefined &&
					conversation.partialVariantSelection.productId === product._id;

				if (hasPartialSelection && variantQuery && conversation.partialVariantSelection) {
					// Combine stored partial selection with new query
					const stored = conversation.partialVariantSelection.selectedOptions;
					variantQuery = Object.values(stored)
						.filter((v) => v !== undefined)
						.concat(variantQuery)
						.join(" ");
				}

				if (!variantQuery) {
					// No variant specified - ask customer which variant
					const availableVariants = variants.filter((v) => v.available);
					const options = availableVariants.map((v) => {
						const display = formatVariantDisplay(v);
						const priceFormatted = `$${(v.price / 100).toFixed(2)}`;
						return `${display} (${priceFormatted})`;
					});
					return {
						success: false,
						message: `"${product.name}" has multiple options. Which would you like: ${options.join(", ")}?`,
						data: { needsVariantSelection: true, availableOptions: options },
					};
				}

				// Try to match variant
				const matchResult = matchVariantQuery(variantQuery, variants);

				if (!matchResult.matched) {
					// Check if this is a partial match (some options specified)
					const queryParts = variantQuery.toLowerCase().trim().split(/\s+/);
					const partialMatches = variants.filter((v) => {
						const optionValues = getVariantOptionValues(v);
						return queryParts.some((part) =>
							optionValues.some((opt) => fuzzyMatchVariantValue(part, opt)),
						);
					});

					// If we have partial matches, store the partial selection and ask for missing options
					if (partialMatches.length > 0) {
						// Extract which options are specified in the query
						const selectedOptions: Record<string, string | undefined> = {};
						const firstVariant = variants[0];

						if (firstVariant.option1Name) {
							selectedOptions[firstVariant.option1Name.toLowerCase()] = undefined;
						}
						if (firstVariant.option2Name) {
							selectedOptions[firstVariant.option2Name.toLowerCase()] = undefined;
						}
						if (firstVariant.option3Name) {
							selectedOptions[firstVariant.option3Name.toLowerCase()] = undefined;
						}

						// Fill in matched options
						for (const part of queryParts) {
							for (const variant of partialMatches) {
								const optionsMap = getVariantOptionsMap(variant);
								for (const [optionName, optionValue] of Object.entries(optionsMap)) {
									if (fuzzyMatchVariantValue(part, optionValue)) {
										selectedOptions[optionName] = optionValue;
									}
								}
							}
						}

						// Store partial selection
						await ctx.runMutation(internal.ai.agent.updateOrderState, {
							conversationId: conversation._id,
							partialVariantSelection: {
								productId: product._id,
								selectedOptions,
							},
						});

						// Find missing options
						const missingOptions = getMissingOptions(partialMatches, selectedOptions);
						const missingOptionNames = missingOptions.join(" or ");

						// Get available values for missing options
						const availableForMissing = partialMatches.flatMap((v) => {
							const optionsMap = getVariantOptionsMap(v);
							const missingValues = missingOptions
								.map((opt) => optionsMap[opt])
								.filter((v) => v !== undefined);
							return missingValues;
						});

						const uniqueMissingValues = [...new Set(availableForMissing)];
						const optionsStr = uniqueMissingValues
							.map((v) => {
								const variant = partialMatches.find((pv) => {
									const optionsMap = getVariantOptionsMap(pv);
									return Object.values(optionsMap).includes(v);
								});
								const price = variant ? `$${(variant.price / 100).toFixed(2)}` : "";
								return `${v} (${price})`.trim();
							})
							.join(" or ");

						return {
							success: false,
							message: `${Object.values(selectedOptions)
								.filter((v) => v !== undefined)
								.join(" / ")} selected. Which ${missingOptionNames}: ${optionsStr}?`,
							data: {
								needsVariantSelection: true,
								availableOptions: uniqueMissingValues,
								partialSelection: selectedOptions,
							},
						};
					}

					// Return error with available options
					const optionsStr = matchResult.availableOptions?.join(", ") ?? "";
					return {
						success: false,
						message: `${matchResult.error} ${optionsStr}`,
						data: {
							needsVariantSelection: true,
							availableOptions: matchResult.availableOptions,
						},
					};
				}

				// Variant matched successfully - clear partial selection
				await ctx.runMutation(internal.ai.agent.updateOrderState, {
					conversationId: conversation._id,
					clearPartialVariant: true,
				});

				// Variant matched successfully
				const existingIdx = newItems.findIndex(
					(i) => i.productId === product._id && i.productQuery === matchResult.variantName,
				);
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
					// Store variant name in productQuery for S09's matchVariant to use
					newItems.push({
						productQuery: `${product.name} - ${matchResult.variantName}`,
						quantity: qty,
						productId: product._id,
						price: matchResult.price,
					});
				}
			} else {
				// Simple product without variants (or single variant)
				// Clear partial selection if switching products
				if (
					conversation.partialVariantSelection !== undefined &&
					conversation.partialVariantSelection.productId !== product._id
				) {
					await ctx.runMutation(internal.ai.agent.updateOrderState, {
						conversationId: conversation._id,
						clearPartialVariant: true,
					});
				}

				const variant = variants[0];
				const price = variant?.price ?? product.price;

				const existingIdx = newItems.findIndex((i) => i.productId === product._id);
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
						productQuery: product.name,
						quantity: qty,
						productId: product._id,
						price: price,
					});
				}
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
