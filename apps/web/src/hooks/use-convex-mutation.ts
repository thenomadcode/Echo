import { useMutation } from "convex/react";
import type { FunctionReference, OptionalRestArgs } from "convex/server";
import { toast } from "sonner";

/**
 * Wraps Convex useMutation with automatic error toast handling.
 *
 * Benefits:
 * - Eliminates repetitive try-catch + toast.error boilerplate
 * - Consistent error messaging across the app
 * - Still allows custom error handling when needed
 *
 * @example
 * ```tsx
 * const updateProduct = useConvexMutation(api.products.update);
 *
 * // Automatic error handling with default message
 * await updateProduct({ id, name: "New Name" });
 *
 * // Custom error message
 * await updateProduct(
 *   { id, name: "New Name" },
 *   { errorMessage: "Failed to update product" }
 * );
 *
 * // Custom error handler
 * await updateProduct(
 *   { id, name: "New Name" },
 *   { onError: (error) => console.error("Custom handling", error) }
 * );
 * ```
 */

interface UseConvexMutationOptions {
	errorMessage?: string;
	onError?: (error: Error) => void;
}

export function useConvexMutation<Mutation extends FunctionReference<"mutation">>(
	mutation: Mutation,
) {
	const mutate = useMutation(mutation);

	return async (...args: [...OptionalRestArgs<Mutation>, UseConvexMutationOptions?]) => {
		const options = args[args.length - 1] as UseConvexMutationOptions | undefined;
		const mutationArgs = (
			typeof options === "object" && (options?.errorMessage || options?.onError)
				? args.slice(0, -1)
				: args
		) as OptionalRestArgs<Mutation>;

		try {
			return await mutate(...mutationArgs);
		} catch (error) {
			const err = error instanceof Error ? error : new Error("Unknown error");

			if (options?.onError) {
				options.onError(err);
			} else {
				const message = options?.errorMessage || err.message || "An error occurred";
				toast.error(message);
			}

			throw error;
		}
	};
}
