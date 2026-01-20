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
];

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface UpdateOrderArgs {
  action: "add" | "remove" | "set_quantity" | "clear";
  items?: Array<{
    product_name: string;
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
