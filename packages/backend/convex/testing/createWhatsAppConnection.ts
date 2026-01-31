import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Testing helper: Create a WhatsApp connection for webhook testing
 */
export const createTestConnection = mutation({
	args: {
		businessId: v.id("businesses"),
		phoneNumber: v.string(),
		phoneNumberId: v.string(),
		provider: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("whatsappConnections")
			.withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
			.first();

		if (existing) {
			return {
				success: true,
				connectionId: existing._id,
				message: "Connection already exists",
			};
		}

		const connectionId = await ctx.db.insert("whatsappConnections", {
			businessId: args.businessId,
			phoneNumber: args.phoneNumber,
			phoneNumberId: args.phoneNumberId,
			provider: args.provider,
			credentials: {
				accountSid: "TEST_ACCOUNT_SID",
				authToken: "TEST_AUTH_TOKEN",
			},
			verified: true,
			createdAt: Date.now(),
		});

		return {
			success: true,
			connectionId,
			message: "WhatsApp connection created successfully",
		};
	},
});
