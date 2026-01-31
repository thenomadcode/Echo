import { v } from "convex/values";
import { query } from "../_generated/server";

export const getWhatsAppConnection = query({
	args: {
		phoneNumber: v.string(),
	},
	handler: async (ctx, args) => {
		const connection = await ctx.db
			.query("whatsappConnections")
			.withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
			.first();

		return connection;
	},
});

export const getRecentConversations = query({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const conversations = await ctx.db
			.query("conversations")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.order("desc")
			.take(5);

		return conversations;
	},
});

export const getRecentMessages = query({
	args: {},
	handler: async (ctx) => {
		const messages = await ctx.db.query("messages").order("desc").take(10);

		return messages;
	},
});

export const getRecentOrders = query({
	args: {
		businessId: v.id("businesses"),
	},
	handler: async (ctx, args) => {
		const orders = await ctx.db
			.query("orders")
			.withIndex("by_business", (q) => q.eq("businessId", args.businessId))
			.order("desc")
			.take(5);

		return orders;
	},
});

export const getCustomerDetails = query({
	args: {
		customerPhone: v.string(),
	},
	handler: async (ctx, args) => {
		const customer = await ctx.db
			.query("customers")
			.withIndex("by_phone", (q) => q.eq("phone", args.customerPhone))
			.first();

		if (!customer) return null;

		const addresses = await ctx.db
			.query("customerAddresses")
			.withIndex("by_customer", (q) => q.eq("customerRecordId", customer._id))
			.collect();

		return {
			customer,
			addresses,
		};
	},
});
