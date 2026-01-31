import { v } from "convex/values";
import { action } from "../_generated/server";

export const sendToWebhook = action({
	args: {
		fromPhone: v.string(),
		toPhone: v.string(),
		message: v.string(),
	},
	handler: async (_ctx, args) => {
		const webhookUrl = "https://careful-mandrill-967.convex.site/webhook/whatsapp";

		const payload = new URLSearchParams({
			MessageSid: `SM${Date.now()}TEST`,
			From: `whatsapp:${args.fromPhone}`,
			To: `whatsapp:${args.toPhone}`,
			Body: args.message,
			NumMedia: "0",
		});

		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: payload.toString(),
		});

		return {
			status: response.status,
			statusText: response.statusText,
			body: await response.text(),
		};
	},
});
