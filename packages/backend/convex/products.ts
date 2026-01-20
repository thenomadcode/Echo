import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const create = mutation({
  args: {
    businessId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    categoryId: v.optional(v.string()),
    imageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    const business = await ctx.db
      .query("businesses")
      .filter((q) => q.eq(q.field("_id"), args.businessId))
      .first();

    if (!business) {
      throw new Error("Business not found");
    }

    if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to create products for this business");
    }

    const now = Date.now();
    
    const existingProducts = await ctx.db
      .query("products")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .collect();
    
    const maxOrder = existingProducts.reduce(
      (max, p) => Math.max(max, p.order),
      -1
    );

    const productId = await ctx.db.insert("products", {
      businessId: args.businessId,
      name: args.name,
      description: args.description,
      price: args.price,
      currency: business.defaultLanguage === "es" ? "COP" : business.defaultLanguage === "pt" ? "BRL" : "USD",
      categoryId: args.categoryId,
      imageId: args.imageId,
      available: true,
      deleted: false,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });

    return productId;
  },
});

export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    categoryId: v.optional(v.string()),
    imageId: v.optional(v.string()),
    available: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const business = await ctx.db
      .query("businesses")
      .filter((q) => q.eq(q.field("_id"), product.businessId))
      .first();

    if (!business) {
      throw new Error("Business not found");
    }

    if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to update this product");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.price !== undefined) updates.price = args.price;
    if (args.categoryId !== undefined) updates.categoryId = args.categoryId;
    if (args.imageId !== undefined) updates.imageId = args.imageId;
    if (args.available !== undefined) updates.available = args.available;

    await ctx.db.patch(args.productId, updates);

    return args.productId;
  },
});

export const deleteProduct = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    const business = await ctx.db
      .query("businesses")
      .filter((q) => q.eq(q.field("_id"), product.businessId))
      .first();

    if (!business) {
      throw new Error("Business not found");
    }

    if (business.ownerId !== authUser._id) {
      throw new Error("Not authorized to delete this product");
    }

    await ctx.db.patch(args.productId, {
      deleted: true,
      updatedAt: Date.now(),
    });

    return args.productId;
  },
});

export const get = query({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    const product = await ctx.db.get(args.productId);
    if (!product) {
      return null;
    }

    const business = await ctx.db
      .query("businesses")
      .filter((q) => q.eq(q.field("_id"), product.businessId))
      .first();

    if (!business) {
      return null;
    }

    if (business.ownerId !== authUser._id) {
      return null;
    }

    return product;
  },
});

export const list = query({
  args: {
    businessId: v.string(),
    categoryId: v.optional(v.string()),
    available: v.optional(v.boolean()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return { products: [], hasMore: false, nextCursor: undefined };
    }

    const business = await ctx.db
      .query("businesses")
      .filter((q) => q.eq(q.field("_id"), args.businessId))
      .first();

    if (!business) {
      return { products: [], hasMore: false, nextCursor: undefined };
    }

    if (business.ownerId !== authUser._id) {
      return { products: [], hasMore: false, nextCursor: undefined };
    }

    let productsQuery = ctx.db
      .query("products")
      .withIndex("by_business", (q) => 
        q.eq("businessId", args.businessId).eq("deleted", false)
      );

    let allProducts = await productsQuery.collect();

    if (args.categoryId !== undefined) {
      allProducts = allProducts.filter((p) => p.categoryId === args.categoryId);
    }

    if (args.available !== undefined) {
      allProducts = allProducts.filter((p) => p.available === args.available);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      allProducts = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
      );
    }

    allProducts.sort((a, b) => a.order - b.order);

    const offset = args.cursor ?? 0;
    const limit = args.limit ?? 50;

    const paginatedProducts = allProducts.slice(offset, offset + limit);
    const hasMore = allProducts.length > offset + limit;
    const nextCursor = hasMore ? offset + limit : undefined;

    return {
      products: paginatedProducts,
      hasMore,
      nextCursor,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const getImageUrl = query({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      return null;
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

export const bulkUpdateAvailability = mutation({
  args: {
    productIds: v.array(v.id("products")),
    available: v.boolean(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    let updatedCount = 0;
    const now = Date.now();

    for (const productId of args.productIds) {
      const product = await ctx.db.get(productId);
      if (!product) {
        continue;
      }

      const business = await ctx.db
        .query("businesses")
        .filter((q) => q.eq(q.field("_id"), product.businessId))
        .first();

      if (!business) {
        continue;
      }

      if (business.ownerId !== authUser._id) {
        throw new Error("Not authorized to update products for this business");
      }

      await ctx.db.patch(productId, {
        available: args.available,
        updatedAt: now,
      });

      updatedCount++;
    }

    return updatedCount;
  },
});

export const bulkDelete = mutation({
  args: {
    productIds: v.array(v.id("products")),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    let deletedCount = 0;
    const now = Date.now();

    for (const productId of args.productIds) {
      const product = await ctx.db.get(productId);
      if (!product) {
        continue;
      }

      const business = await ctx.db
        .query("businesses")
        .filter((q) => q.eq(q.field("_id"), product.businessId))
        .first();

      if (!business) {
        continue;
      }

      if (business.ownerId !== authUser._id) {
        throw new Error("Not authorized to delete products for this business");
      }

      await ctx.db.patch(productId, {
        deleted: true,
        updatedAt: now,
      });

      deletedCount++;
    }

    return deletedCount;
  },
});

export const bulkUpdateCategory = mutation({
  args: {
    productIds: v.array(v.id("products")),
    categoryId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.safeGetAuthUser(ctx);
    if (!authUser || !authUser._id) {
      throw new Error("Not authenticated");
    }

    let updatedCount = 0;
    const now = Date.now();

    for (const productId of args.productIds) {
      const product = await ctx.db.get(productId);
      if (!product) {
        continue;
      }

      const business = await ctx.db
        .query("businesses")
        .filter((q) => q.eq(q.field("_id"), product.businessId))
        .first();

      if (!business) {
        continue;
      }

      if (business.ownerId !== authUser._id) {
        throw new Error("Not authorized to update products for this business");
      }

      await ctx.db.patch(productId, {
        categoryId: args.categoryId,
        updatedAt: now,
      });

      updatedCount++;
    }

    return updatedCount;
  },
});

export const seedTestProducts = internalMutation({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId).eq("deleted", false))
      .collect();

    if (existing.length > 0) {
      return { seeded: false, message: "Products already exist for this business" };
    }

    const now = Date.now();
    const testProducts = [
      { name: "Cappuccino", description: "Creamy Italian coffee", price: 450 },
      { name: "Latte", description: "Smooth espresso with steamed milk", price: 500 },
      { name: "Chocolate Croissant", description: "Buttery, flaky croissant with rich chocolate filling", price: 400 },
    ];

    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];
      if (!product) continue;
      await ctx.db.insert("products", {
        businessId: args.businessId,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: "USD",
        available: true,
        deleted: false,
        order: i,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { seeded: true, count: testProducts.length };
  },
});
