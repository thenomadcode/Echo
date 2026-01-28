import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUser, isBusinessOwner, requireAuth } from "./lib/auth";

export const list = query({
	args: {
		customerId: v.id("customers"),
	},
	handler: async (ctx, args) => {
		const authUser = await requireAuth(ctx);
		if (!authUser) {
			return [];
		}

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return [];
		}

		const isOwner = await isBusinessOwner(ctx, customer.businessId);
		if (!isOwner) {
			return [];
		}

		const addresses = await ctx.db
			.query("customerAddresses")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.collect();

		return addresses.sort((a, b) => {
			const aTime = a.lastUsedAt ?? a.createdAt;
			const bTime = b.lastUsedAt ?? b.createdAt;
			return bTime - aTime;
		});
	},
});

export const add = mutation({
	args: {
		customerId: v.id("customers"),
		address: v.string(),
		label: v.string(),
		isDefault: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		await requireAuth(ctx);

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business) {
			throw new Error("Business not found");
		}

		const isOwner = await isBusinessOwner(ctx, customer.businessId);
		if (!isOwner) {
			throw new Error("Not authorized to add addresses for this customer");
		}

		const existingAddresses = await ctx.db
			.query("customerAddresses")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.collect();

		const isFirstAddress = existingAddresses.length === 0;
		const shouldBeDefault = args.isDefault === true || isFirstAddress;

		if (shouldBeDefault && !isFirstAddress) {
			for (const addr of existingAddresses) {
				if (addr.isDefault) {
					await ctx.db.patch(addr._id, { isDefault: false });
				}
			}
		}

		const addressId = await ctx.db.insert("customerAddresses", {
			customerId: args.customerId,
			address: args.address,
			label: args.label,
			isDefault: shouldBeDefault,
			createdAt: Date.now(),
		});

		return addressId;
	},
});

export const update = mutation({
	args: {
		addressId: v.id("customerAddresses"),
		address: v.optional(v.string()),
		label: v.optional(v.string()),
		isDefault: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const addressRecord = await ctx.db.get(args.addressId);
		if (!addressRecord) {
			throw new Error("Address not found");
		}

		const customer = await ctx.db.get(addressRecord.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business) {
			throw new Error("Business not found");
		}

		if (business.ownerId !== authUser._id) {
			throw new Error("Not authorized to update this address");
		}

		if (args.isDefault === true && !addressRecord.isDefault) {
			const existingAddresses = await ctx.db
				.query("customerAddresses")
				.withIndex("by_customer", (q) => q.eq("customerId", addressRecord.customerId))
				.collect();

			for (const addr of existingAddresses) {
				if (addr.isDefault && addr._id !== args.addressId) {
					await ctx.db.patch(addr._id, { isDefault: false });
				}
			}
		}

		const updates: Record<string, unknown> = {};
		if (args.address !== undefined) updates.address = args.address;
		if (args.label !== undefined) updates.label = args.label;
		if (args.isDefault !== undefined) updates.isDefault = args.isDefault;

		if (Object.keys(updates).length > 0) {
			await ctx.db.patch(args.addressId, updates);
		}

		return args.addressId;
	},
});

export const deleteAddress = mutation({
	args: {
		addressId: v.id("customerAddresses"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const addressRecord = await ctx.db.get(args.addressId);
		if (!addressRecord) {
			throw new Error("Address not found");
		}

		const customer = await ctx.db.get(addressRecord.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business) {
			throw new Error("Business not found");
		}

		if (business.ownerId !== authUser._id) {
			throw new Error("Not authorized to delete this address");
		}

		await ctx.db.delete(args.addressId);

		return args.addressId;
	},
});

export const setDefault = mutation({
	args: {
		addressId: v.id("customerAddresses"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const addressRecord = await ctx.db.get(args.addressId);
		if (!addressRecord) {
			throw new Error("Address not found");
		}

		const customer = await ctx.db.get(addressRecord.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business) {
			throw new Error("Business not found");
		}

		if (business.ownerId !== authUser._id) {
			throw new Error("Not authorized to update this address");
		}

		const existingAddresses = await ctx.db
			.query("customerAddresses")
			.withIndex("by_customer", (q) => q.eq("customerId", addressRecord.customerId))
			.collect();

		for (const addr of existingAddresses) {
			if (addr._id === args.addressId) {
				await ctx.db.patch(addr._id, { isDefault: true });
			} else if (addr.isDefault) {
				await ctx.db.patch(addr._id, { isDefault: false });
			}
		}

		return args.addressId;
	},
});
