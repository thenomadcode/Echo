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
          images(first: 1) {
            edges {
              node {
                url
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
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
