import { v } from "convex/values";
import { internalAction } from "../_generated/server";

/**
 * Download image from external URL and upload to Convex storage
 * Returns the storage ID for storing in database
 */
export const downloadAndUploadImage = internalAction({
	args: {
		imageUrl: v.string(),
	},
	handler: async (ctx, args): Promise<{ storageId?: string; error?: string }> => {
		try {
			// Validate URL format
			let url: URL;
			try {
				url = new URL(args.imageUrl);
			} catch {
				return { error: "Invalid image URL format" };
			}

			// Only allow HTTPS URLs for security
			if (url.protocol !== "https:") {
				return { error: "Only HTTPS URLs are supported" };
			}

			// Download image from external URL
			const response = await fetch(args.imageUrl);

			if (!response.ok) {
				return {
					error: `Failed to download image: ${response.status} ${response.statusText}`,
				};
			}

			// Check content type
			const contentType = response.headers.get("content-type");
			if (!contentType) {
				return { error: "No content-type header in response" };
			}

			// Validate image format (JPEG, PNG, WebP, GIF)
			const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
			if (!validImageTypes.includes(contentType.toLowerCase())) {
				return {
					error: `Unsupported image format: ${contentType}. Supported: JPEG, PNG, WebP, GIF`,
				};
			}

			// Get image data as blob
			const blob = await response.blob();

			// Check file size (max 5MB)
			const maxSize = 5 * 1024 * 1024; // 5MB in bytes
			if (blob.size > maxSize) {
				return {
					error: `Image too large: ${Math.round(blob.size / 1024 / 1024)}MB. Maximum allowed: 5MB`,
				};
			}

			// Upload to Convex storage
			const storageId = await ctx.storage.store(blob);

			return { storageId };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error("Image upload failed:", message);
			return { error: `Image upload failed: ${message}` };
		}
	},
});
