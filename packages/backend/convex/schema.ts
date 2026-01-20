import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  businesses: defineTable({
    // Required fields
    name: v.string(),
    slug: v.string(),
    type: v.union(
      v.literal("restaurant"),
      v.literal("pharmacy"),
      v.literal("retail"),
      v.literal("other")
    ),

    // Optional fields
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    address: v.optional(v.string()),

    // Localization fields (defaults handled in mutations)
    defaultLanguage: v.string(),
    timezone: v.string(),

    // Nested object (optional)
    businessHours: v.optional(
      v.object({
        open: v.string(),
        close: v.string(),
        days: v.array(v.number()),
      })
    ),

    // AI configuration (optional)
    aiGreeting: v.optional(v.string()),
    aiTone: v.optional(v.string()),
    aiEscalationKeywords: v.optional(v.array(v.string())),

    // Relationships
    ownerId: v.string(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"]),

  // Product CMS tables
  categories: defineTable({
    businessId: v.string(),
    name: v.string(),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_business", ["businessId"]),

  products: defineTable({
    businessId: v.string(),
    categoryId: v.optional(v.string()),
    imageId: v.optional(v.string()),
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    available: v.boolean(),
    deleted: v.boolean(),
    order: v.number(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId", "deleted"])
    .index("by_category", ["categoryId", "deleted", "available"]),

  // WhatsApp Integration tables
  whatsappConnections: defineTable({
    businessId: v.id("businesses"),
    provider: v.string(),
    phoneNumberId: v.string(),
    phoneNumber: v.string(),
    credentials: v.object({
      accountSid: v.optional(v.string()),
      authToken: v.optional(v.string()),
      apiKey: v.optional(v.string()),
    }),
    verified: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_phone", ["phoneNumber"]),

  conversations: defineTable({
    businessId: v.id("businesses"),
    customerId: v.string(),
    channel: v.string(),
    channelId: v.string(),
    lastCustomerMessageAt: v.number(),

    // Dashboard status field (active, escalated, closed)
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("escalated"),
        v.literal("closed")
      )
    ),

    // Human assignment - null means AI handling, user ID means human assigned
    assignedTo: v.optional(v.string()),

    // For unread indicator - timestamp of when user last read the conversation
    lastReadAt: v.optional(v.number()),

    // When conversation was closed
    closedAt: v.optional(v.number()),

    // AI Conversation Engine fields
    state: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("browsing"),
        v.literal("ordering"),
        v.literal("confirming"),
        v.literal("payment"),
        v.literal("completed"),
        v.literal("escalated")
      )
    ),
    detectedLanguage: v.optional(v.string()),
    pendingOrder: v.optional(
      v.object({
        items: v.array(
          v.object({
            productQuery: v.string(),
            quantity: v.number(),
            productId: v.optional(v.id("products")),
            price: v.optional(v.number()),
          })
        ),
        total: v.optional(v.number()),
      })
    ),
    pendingDelivery: v.optional(
      v.object({
        type: v.union(v.literal("pickup"), v.literal("delivery")),
        address: v.optional(v.string()),
      })
    ),

    // Escalation reason - why AI escalated to human
    escalationReason: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_channel", ["channelId", "businessId"])
    .index("by_business_status", ["businessId", "status"])
    .index("by_status", ["status"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    sender: v.string(),
    content: v.string(),
    messageType: v.optional(v.string()),
    richContent: v.optional(v.string()),
    externalId: v.optional(v.string()),
    deliveryStatus: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_external_id", ["externalId"]),

  aiLogs: defineTable({
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
          })
        )
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
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // Order Flow tables
  orders: defineTable({
    businessId: v.id("businesses"),
    conversationId: v.id("conversations"),
    orderNumber: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("confirmed"),
      v.literal("paid"),
      v.literal("preparing"),
      v.literal("ready"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    items: v.array(
      v.object({
        productId: v.id("products"),
        name: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        totalPrice: v.number(),
      })
    ),
    subtotal: v.number(),
    deliveryFee: v.optional(v.number()),
    total: v.number(),
    currency: v.string(),
    deliveryType: v.union(v.literal("delivery"), v.literal("pickup")),
    deliveryAddress: v.optional(v.string()),
    deliveryNotes: v.optional(v.string()),
    contactPhone: v.string(),
    contactName: v.optional(v.string()),
    paymentMethod: v.union(v.literal("card"), v.literal("cash")),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    paymentLinkUrl: v.optional(v.string()),
    paymentLinkExpiresAt: v.optional(v.number()),
    stripeSessionId: v.optional(v.string()),
    estimatedReadyTime: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(v.string()),
  })
    .index("by_business", ["businessId", "status", "createdAt"])
    .index("by_conversation", ["conversationId"])
    .index("by_number", ["orderNumber"])
    .index("by_payment_session", ["stripeSessionId"]),

  // Conversation Dashboard notifications
  notifications: defineTable({
    userId: v.string(),
    type: v.union(v.literal("escalation"), v.literal("new_order")),
    conversationId: v.id("conversations"),
    read: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId", "read", "createdAt"]),
});
