import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const list = query({
	args: {
		customerId: v.id("customers"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return [];
		}

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			return [];
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business || business.ownerId !== authUser._id) {
			return [];
		}

		const notes = await ctx.db
			.query("customerNotes")
			.withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
			.collect();

		return notes.sort((a, b) => b.createdAt - a.createdAt);
	},
});

export const add = mutation({
	args: {
		customerId: v.id("customers"),
		note: v.string(),
		staffOnly: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const customer = await ctx.db.get(args.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business) {
			throw new Error("Business not found");
		}

		if (business.ownerId !== authUser._id) {
			throw new Error("Not authorized to add notes for this customer");
		}

		const noteId = await ctx.db.insert("customerNotes", {
			customerId: args.customerId,
			note: args.note,
			addedBy: authUser._id,
			staffOnly: args.staffOnly ?? false,
			createdAt: Date.now(),
		});

		return noteId;
	},
});

export const update = mutation({
	args: {
		noteId: v.id("customerNotes"),
		note: v.optional(v.string()),
		staffOnly: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const noteRecord = await ctx.db.get(args.noteId);
		if (!noteRecord) {
			throw new Error("Note not found");
		}

		const customer = await ctx.db.get(noteRecord.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business) {
			throw new Error("Business not found");
		}

		if (business.ownerId !== authUser._id) {
			throw new Error("Not authorized to update this note");
		}

		const updates: Record<string, unknown> = {};
		if (args.note !== undefined) updates.note = args.note;
		if (args.staffOnly !== undefined) updates.staffOnly = args.staffOnly;

		if (Object.keys(updates).length > 0) {
			await ctx.db.patch(args.noteId, updates);
		}

		return args.noteId;
	},
});

export const deleteNote = mutation({
	args: {
		noteId: v.id("customerNotes"),
	},
	handler: async (ctx, args) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			throw new Error("Not authenticated");
		}

		const noteRecord = await ctx.db.get(args.noteId);
		if (!noteRecord) {
			throw new Error("Note not found");
		}

		const customer = await ctx.db.get(noteRecord.customerId);
		if (!customer) {
			throw new Error("Customer not found");
		}

		const business = await ctx.db.get(customer.businessId);
		if (!business) {
			throw new Error("Business not found");
		}

		if (business.ownerId !== authUser._id) {
			throw new Error("Not authorized to delete this note");
		}

		await ctx.db.delete(args.noteId);

		return args.noteId;
	},
});
