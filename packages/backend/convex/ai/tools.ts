import type OpenAI from "openai";

export type Tool = OpenAI.Chat.ChatCompletionTool;

export const ORDER_TOOLS: Tool[] = [
	{
		type: "function",
		function: {
			name: "update_order",
			description:
				"Add, remove, or modify items in the customer's order. Use this whenever the customer wants to change what they're ordering.",
			parameters: {
				type: "object",
				properties: {
					action: {
						type: "string",
						enum: ["add", "remove", "set_quantity", "clear"],
						description:
							"The action to perform: add items, remove items, set specific quantity, or clear entire order",
					},
					items: {
						type: "array",
						items: {
							type: "object",
							properties: {
								product_name: {
									type: "string",
									description: "Name of the product (must match available products)",
								},
								variant_specification: {
									type: "string",
									description:
										"For products with variants: specify which variant (e.g., 'Small', 'Red', 'Small / Red'). Leave empty to ask customer which variant they want.",
								},
								quantity: {
									type: "number",
									description: "Quantity (for add/set_quantity actions)",
								},
							},
							required: ["product_name"],
						},
						description: "Items to add/remove/modify (not needed for clear action)",
					},
				},
				required: ["action"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "set_delivery",
			description:
				"Set the delivery preference for the order. Use when customer specifies pickup or delivery.",
			parameters: {
				type: "object",
				properties: {
					type: {
						type: "string",
						enum: ["pickup", "delivery"],
						description: "Pickup from store or delivery to address",
					},
					address: {
						type: "string",
						description: "Delivery address (required if type is delivery)",
					},
				},
				required: ["type"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "submit_order",
			description:
				"Submit and confirm the order. Only use when: 1) Order has items, 2) Delivery preference is set, 3) Customer has confirmed they want to proceed, 4) Payment method is specified.",
			parameters: {
				type: "object",
				properties: {
					payment_method: {
						type: "string",
						enum: ["cash", "card"],
						description: "How the customer will pay",
					},
					customer_confirmed: {
						type: "boolean",
						description: "Set to true only if customer explicitly confirmed the order",
					},
				},
				required: ["payment_method", "customer_confirmed"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "cancel_order",
			description:
				"Cancel the current order and clear all order data. Use when customer wants to start over or abandon their order.",
			parameters: {
				type: "object",
				properties: {
					reason: {
						type: "string",
						description: "Brief reason for cancellation",
					},
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "escalate_to_human",
			description:
				"Transfer the conversation to a human agent. Use when: customer explicitly requests it, you cannot help them, they seem frustrated, or the situation requires human judgment.",
			parameters: {
				type: "object",
				properties: {
					reason: {
						type: "string",
						description: "Why escalation is needed",
					},
				},
				required: ["reason"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "create_deletion_request",
			description:
				"Submit a request to delete customer data. Use when customer explicitly confirms they want their data deleted (after you asked for confirmation). Do NOT use just because they mentioned it - wait for confirmation.",
			parameters: {
				type: "object",
				properties: {
					confirmed: {
						type: "boolean",
						description:
							"Set to true ONLY if customer explicitly confirmed deletion (said yes/si/sim/sure/okay)",
					},
				},
				required: ["confirmed"],
			},
		},
	},
];

export interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

export interface UpdateOrderArgs {
	action: "add" | "remove" | "set_quantity" | "clear";
	items?: Array<{
		product_name: string;
		variant_specification?: string;
		quantity?: number;
	}>;
}

export interface SetDeliveryArgs {
	type: "pickup" | "delivery";
	address?: string;
}

export interface SubmitOrderArgs {
	payment_method: "cash" | "card";
	customer_confirmed: boolean;
}

export interface CancelOrderArgs {
	reason?: string;
}

export interface EscalateArgs {
	reason: string;
}

export interface CreateDeletionRequestArgs {
	confirmed: boolean;
}

// ============================================
// Customer Memory & Notes Tools
// ============================================

export interface SaveCustomerPreferenceArgs {
	customer_id: string;
	category: "allergy" | "restriction" | "preference" | "behavior";
	fact: string;
	conversation_id: string;
}

export interface SaveCustomerAddressArgs {
	customer_id: string;
	address: string;
	label?: string;
	set_as_default?: boolean;
	conversation_id: string;
}

export interface AddCustomerNoteArgs {
	customer_id: string;
	note: string;
	conversation_id: string;
}

export const CUSTOMER_TOOLS: Tool[] = [
	{
		type: "function",
		function: {
			name: "save_customer_preference",
			description:
				"Save a preference, allergy, restriction, or behavior about the customer. " +
				"Use this whenever the customer mentions something about themselves that should be remembered. " +
				"Examples: 'I'm vegetarian', ' allergic to nuts', 'always orders decaf', 'prefers spicy food'.",
			parameters: {
				type: "object",
				properties: {
					customer_id: {
						type: "string",
						description: "The customer ID",
					},
					category: {
						type: "string",
						enum: ["allergy", "restriction", "preference", "behavior"],
						description:
							"Type of memory: allergy (safety critical), restriction (dietary), preference (likes/dislikes), behavior (ordering patterns)",
					},
					fact: {
						type: "string",
						description: "The fact to remember (max 200 chars)",
					},
					conversation_id: {
						type: "string",
						description: "The conversation ID",
					},
				},
				required: ["customer_id", "category", "fact", "conversation_id"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "save_customer_address",
			description:
				"Save or update a customer's delivery address. " +
				"Use this when the customer provides a new delivery address. " +
				"Automatically detects if address already exists and updates it instead of creating duplicates.",
			parameters: {
				type: "object",
				properties: {
					customer_id: {
						type: "string",
						description: "The customer ID",
					},
					address: {
						type: "string",
						description: "Full delivery address",
					},
					label: {
						type: "string",
						description: "Optional label (Home, Work, etc.) - auto-generated if not provided",
					},
					set_as_default: {
						type: "boolean",
						description: "Set as default delivery address (default: true for first address)",
					},
					conversation_id: {
						type: "string",
						description: "The conversation ID",
					},
				},
				required: ["customer_id", "address", "conversation_id"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "add_customer_note",
			description:
				"Add a note about the customer for the business staff. " +
				"Use this to record important context that staff should know. " +
				"Examples: 'Customer mentioned birthday next week', 'Prefers phone calls over messages', 'Large order customer'." +
				"Do NOT use for preferences that should auto-remember - use save_customer_preference instead.",
			parameters: {
				type: "object",
				properties: {
					customer_id: {
						type: "string",
						description: "The customer ID",
					},
					note: {
						type: "string",
						description: "The note to add (max 500 chars)",
					},
					conversation_id: {
						type: "string",
						description: "The conversation ID",
					},
				},
				required: ["customer_id", "note", "conversation_id"],
			},
		},
	},
];
