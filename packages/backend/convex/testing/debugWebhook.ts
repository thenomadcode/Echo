import { action } from "../_generated/server";

export const testPayloadParsing = action({
	args: {},
	handler: async () => {
		const testPayload = {
			MessageSid: "SM1738348800TEST",
			From: "whatsapp:+15557776666",
			To: "whatsapp:+14155238886",
			Body: "Hi! I'm interested in buying a snowboard",
			NumMedia: "0",
		};

		function extractToPhoneNumber(payload: unknown): string | null {
			if (!payload || typeof payload !== "object") {
				return null;
			}

			const data = payload as Record<string, unknown>;

			if (typeof data.To === "string") {
				return data.To.replace("whatsapp:", "");
			}

			return null;
		}

		const toPhoneNumber = extractToPhoneNumber(testPayload);

		return {
			payload: testPayload,
			extractedToPhone: toPhoneNumber,
			hasTo: "To" in testPayload,
			toValue: testPayload.To,
		};
	},
});
