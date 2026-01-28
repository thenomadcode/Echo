/**
 * AI Conversation Engine types
 * Abstraction for AI providers (OpenAI, Anthropic, Google, etc.)
 */

export type MessageRole = "system" | "user" | "assistant";

export interface Message {
	role: MessageRole;
	content: string;
}

export type ResponseFormat = "text" | "json";

export interface CompleteParams {
	messages: Message[];
	systemPrompt: string;
	temperature?: number;
	maxTokens?: number;
	responseFormat?: ResponseFormat;
}

export interface CompleteResult {
	content: string;
	tokensUsed: number;
	model: string;
}

/**
 * AI Provider Interface - all provider implementations must implement this
 */
export interface AIProvider {
	complete(params: CompleteParams): Promise<CompleteResult>;
}

export interface OrderItem {
	productQuery: string;
	quantity: number;
}

export type OrderAction = "add" | "remove" | "change_quantity";

interface BaseIntent {
	type: string;
}

// Intent: "Hello", "Hi there"
export interface GreetingIntent extends BaseIntent {
	type: "greeting";
}

// Intent: "Do you have pizza?", "How much is the burger?"
export interface ProductQuestionIntent extends BaseIntent {
	type: "product_question";
	query: string;
}

// Intent: "I want to order 2 pizzas"
export interface OrderStartIntent extends BaseIntent {
	type: "order_start";
	items: OrderItem[];
}

// Intent: "Add one more", "Remove the fries"
export interface OrderModifyIntent extends BaseIntent {
	type: "order_modify";
	action: OrderAction;
	item: string;
}

// Intent: "What time do you close?", "Do you deliver?"
export interface BusinessQuestionIntent extends BaseIntent {
	type: "business_question";
	topic: string;
}

// Intent: "I want to talk to a human"
export interface EscalationRequestIntent extends BaseIntent {
	type: "escalation_request";
}

// Intent: "How are you?", "Nice weather"
export interface SmallTalkIntent extends BaseIntent {
	type: "small_talk";
}

// Intent: "That's all", "I'm done", "Ready to order", "Eso es todo"
export interface OrderConfirmIntent extends BaseIntent {
	type: "order_confirm";
}

// Intent: "Pickup", "Delivery to [address]", "Recoger", "Entrega"
export interface DeliveryChoiceIntent extends BaseIntent {
	type: "delivery_choice";
	deliveryType: "pickup" | "delivery";
	address?: string;
}

// Intent: "Cash", "Card", "Efectivo", "Tarjeta"
export interface PaymentChoiceIntent extends BaseIntent {
	type: "payment_choice";
	paymentMethod: "cash" | "card";
}

// Intent: User provides an address when asked (e.g., "123 Main St")
export interface AddressProvidedIntent extends BaseIntent {
	type: "address_provided";
	address: string;
}

export interface UnknownIntent extends BaseIntent {
	type: "unknown";
}

export type OffTopicCategory =
	| "politics"
	| "flirting"
	| "inappropriate"
	| "manipulation"
	| "unrelated";

export interface OffTopicIntent extends BaseIntent {
	type: "off_topic";
	category: OffTopicCategory;
}

export type Intent =
	| GreetingIntent
	| ProductQuestionIntent
	| OrderStartIntent
	| OrderModifyIntent
	| BusinessQuestionIntent
	| EscalationRequestIntent
	| SmallTalkIntent
	| OrderConfirmIntent
	| DeliveryChoiceIntent
	| PaymentChoiceIntent
	| AddressProvidedIntent
	| OffTopicIntent
	| UnknownIntent;

export type IntentType = Intent["type"];

export interface AIResponse {
	response: string;
	intent: Intent;
	shouldEscalate: boolean;
	detectedLanguage: string;
}

export interface SerializedIntent {
	type: string;
	query?: string;
	items?: OrderItem[];
	action?: string;
	item?: string;
	topic?: string;
	deliveryType?: "pickup" | "delivery";
	address?: string;
	paymentMethod?: "cash" | "card";
	category?: OffTopicCategory;
}

export function serializeIntent(intent: Intent): SerializedIntent {
	const base: SerializedIntent = { type: intent.type };

	switch (intent.type) {
		case "product_question":
			return { ...base, query: intent.query };
		case "order_start":
			return { ...base, items: intent.items };
		case "order_modify":
			return { ...base, action: intent.action, item: intent.item };
		case "business_question":
			return { ...base, topic: intent.topic };
		case "delivery_choice":
			return { ...base, deliveryType: intent.deliveryType, address: intent.address };
		case "payment_choice":
			return { ...base, paymentMethod: intent.paymentMethod };
		case "address_provided":
			return { ...base, address: intent.address };
		case "off_topic":
			return { ...base, category: intent.category };
		default:
			return base;
	}
}

export function parseIntent(serialized: SerializedIntent): Intent {
	switch (serialized.type) {
		case "greeting":
			return { type: "greeting" };
		case "product_question":
			return { type: "product_question", query: serialized.query ?? "" };
		case "order_start":
			return { type: "order_start", items: serialized.items ?? [] };
		case "order_modify":
			return {
				type: "order_modify",
				action: (serialized.action as OrderAction) ?? "add",
				item: serialized.item ?? "",
			};
		case "business_question":
			return { type: "business_question", topic: serialized.topic ?? "" };
		case "escalation_request":
			return { type: "escalation_request" };
		case "small_talk":
			return { type: "small_talk" };
		case "order_confirm":
			return { type: "order_confirm" };
		case "delivery_choice":
			return {
				type: "delivery_choice",
				deliveryType: serialized.deliveryType ?? "pickup",
				address: serialized.address,
			};
		case "payment_choice":
			return {
				type: "payment_choice",
				paymentMethod: serialized.paymentMethod ?? "cash",
			};
		case "address_provided":
			return {
				type: "address_provided",
				address: serialized.address ?? "",
			};
		case "off_topic":
			return {
				type: "off_topic",
				category: (serialized.category as OffTopicCategory) ?? "unrelated",
			};
		default:
			return { type: "unknown" };
	}
}
