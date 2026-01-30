export function normalizeShopUrl(shop: string): string | null {
	const trimmed = shop.trim().toLowerCase();

	if (trimmed.endsWith(".myshopify.com")) {
		const match = trimmed.match(/^([a-z0-9-]+)\.myshopify\.com$/);
		if (match) {
			return trimmed;
		}
		return null;
	}

	const storeNameMatch = trimmed.match(/^[a-z0-9-]+$/);
	if (storeNameMatch) {
		return `${trimmed}.myshopify.com`;
	}

	return null;
}

export function generateStateParameter(): string {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return Array.from(array)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export const SHOPIFY_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          descriptionHtml
          status
          images(first: 10) {
            edges {
              node {
                url
              }
            }
          }
          options {
            name
            position
            values
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                sku
                barcode
                inventoryQuantity
                availableForSale
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                }
                weight
                weightUnit
                requiresShipping
                position
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const WEBHOOK_TOPICS = [
	"products/create",
	"products/update",
	"products/delete",
	"orders/paid",
] as const;

export async function downloadAndStoreImage(
	ctx: { storage: { store: (blob: Blob) => Promise<string> } },
	imageUrl: string,
): Promise<string | null> {
	try {
		const response = await fetch(imageUrl);
		if (!response.ok) {
			console.error(`Failed to download image: ${response.status} ${response.statusText}`);
			return null;
		}

		const blob = await response.blob();
		const storageId = await ctx.storage.store(blob);
		return storageId;
	} catch (error) {
		console.error(`Error downloading and storing image from ${imageUrl}:`, error);
		return null;
	}
}
