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
});
