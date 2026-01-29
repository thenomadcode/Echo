import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";
import { authComponent } from "../auth";

type ConvexCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;
type ConvexCtxWithActions =
	| GenericQueryCtx<DataModel>
	| GenericMutationCtx<DataModel>
	| GenericActionCtx<DataModel>;

/**
 * Returns the authenticated user or null if not authenticated.
 * Does not throw an error.
 * Works in queries, mutations, and actions.
 *
 * @example
 * const user = await getAuthUser(ctx);
 * if (!user) return null;
 */
export async function getAuthUser(ctx: ConvexCtxWithActions) {
	return await authComponent.safeGetAuthUser(ctx);
}

/**
 * Requires authentication and returns the authenticated user.
 * Throws an error if the user is not authenticated.
 * Works in queries, mutations, and actions.
 *
 * @throws {Error} "Not authenticated" if user is not authenticated
 * @example
 * const user = await requireAuth(ctx);
 * // user._id is guaranteed to exist here
 */
export async function requireAuth(ctx: ConvexCtxWithActions) {
	const authUser = await authComponent.safeGetAuthUser(ctx);
	if (!authUser || !authUser._id) {
		throw new Error("Not authenticated");
	}
	return authUser;
}

/**
 * Checks if the authenticated user owns the specified business.
 * Returns true if the user is the owner, false otherwise.
 * Returns false if not authenticated.
 *
 * @example
 * const isOwner = await isBusinessOwner(ctx, businessId);
 * if (!isOwner) return null;
 */
export async function isBusinessOwner(ctx: ConvexCtx, businessId: Id<"businesses">) {
	const authUser = await authComponent.safeGetAuthUser(ctx);
	if (!authUser || !authUser._id) {
		return false;
	}

	const business = await ctx.db.get(businessId);
	if (!business) {
		return false;
	}

	return business.ownerId === authUser._id;
}

/**
 * Requires that the authenticated user owns the specified business.
 * Throws an error if not authenticated or if the user doesn't own the business.
 *
 * @throws {Error} "Not authenticated" if user is not authenticated
 * @throws {Error} "Business not found" if business doesn't exist
 * @throws {Error} "Not authorized to access this business" if user doesn't own the business
 * @example
 * const { user, business } = await requireBusinessOwnership(ctx, businessId);
 * // user and business are guaranteed to exist here, and user owns business
 */
export async function requireBusinessOwnership(ctx: ConvexCtx, businessId: Id<"businesses">) {
	const authUser = await requireAuth(ctx);

	const business = await ctx.db.get(businessId);
	if (!business) {
		throw new Error("Business not found");
	}

	if (business.ownerId !== authUser._id) {
		throw new Error("Not authorized to access this business");
	}

	return { user: authUser, business };
}
