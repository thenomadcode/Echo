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

    // Relationships
    ownerId: v.string(),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"]),

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
    status: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_channel", ["channelId", "businessId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    sender: v.string(),
    content: v.string(),
    messageType: v.optional(v.string()),
    // JSON-encoded structured data for buttons/list messages
    richContent: v.optional(v.string()),
    externalId: v.optional(v.string()),
    deliveryStatus: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"]),
});
