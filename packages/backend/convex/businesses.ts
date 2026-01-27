import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // [^\w\s-] matches any non-word, non-space, non-hyphen char
    .replace(/\s+/g, "-") // \s+ matches one or more whitespace
    .replace(/-+/g, "-") // -+ matches consecutive hyphens
    .replace(/^-+|-+$/g, ""); // ^-+ matches leading hyphens, -+$ matches trailing
}

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("restaurant"),
      v.literal("pharmacy"),
      v.literal("retail"),
      v.literal("other")
    ),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    let slug = generateSlug(args.name);

    let slugSuffix = 1;
    let finalSlug = slug;
    while (true) {
      const existing = await ctx.db
        .query("businesses")
        .withIndex("by_slug", (q) => q.eq("slug", finalSlug))
        .first();

      if (!existing) {
        break;
      }

      finalSlug = `${slug}-${slugSuffix}`;
      slugSuffix++;
    }

    const now = Date.now();
    const businessId = await ctx.db.insert("businesses", {
      name: args.name,
      slug: finalSlug,
      type: args.type,
      description: args.description,
      logoUrl: args.logoUrl,
      address: args.address,
      defaultLanguage: "en",
      timezone: "UTC",
      ownerId: authUser._id,
      createdAt: now,
      updatedAt: now,
    });

    return businessId;
  },
});

export const update = mutation({
  args: {
    businessId: v.id("businesses"),
    name: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("restaurant"),
        v.literal("pharmacy"),
        v.literal("retail"),
        v.literal("other")
      )
    ),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    address: v.optional(v.string()),
    defaultLanguage: v.optional(v.string()),
    timezone: v.optional(v.string()),
    businessHours: v.optional(
      v.object({
        open: v.string(),
        close: v.string(),
        days: v.array(v.number()),
      })
    ),
    aiGreeting: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to update this business");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.type !== undefined) updates.type = args.type;
    if (args.description !== undefined) updates.description = args.description;
    if (args.logoUrl !== undefined) updates.logoUrl = args.logoUrl;
    if (args.address !== undefined) updates.address = args.address;
    if (args.defaultLanguage !== undefined)
      updates.defaultLanguage = args.defaultLanguage;
    if (args.timezone !== undefined) updates.timezone = args.timezone;
    if (args.businessHours !== undefined)
      updates.businessHours = args.businessHours;
    if (args.aiGreeting !== undefined) updates.aiGreeting = args.aiGreeting;

    await ctx.db.patch(args.businessId, updates);

    return args.businessId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return [];
    }

    const userId = authUser._id;

    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    return businesses;
  },
});

export const get = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return null;
    }

    if (business.ownerId !== authUser._id) {
      return null;
    }

    return business;
  },
});
