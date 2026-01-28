import { query } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

export const get = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await getAuthUser(ctx);
		if (!authUser) {
			return {
				message: "Not authenticated",
			};
		}
		return {
			message: "This is private",
		};
	},
});
