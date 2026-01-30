/**
 * Shopify Integration Types
 * Based on Shopify Admin API 2024-01
 */

// ============================================================================
// OAuth Types
// ============================================================================

export type ShopifyTokenResponse = {
	access_token: string;
	scope: string;
};

export type ShopifyErrorResponse = {
	error?: string;
	error_description?: string;
};

// ============================================================================
// GraphQL Response Types
// ============================================================================

export type ShopifyGraphQLResponse = {
	data?: {
		products: {
			edges: Array<{
				node: {
					id: string;
					title: string;
					descriptionHtml: string;
					status: string;
					images: {
						edges: Array<{
							node: {
								url: string;
							};
						}>;
					};
					options: Array<{
						name: string;
						position: number;
						values: string[];
					}>;
					variants: {
						edges: Array<{
							node: {
								id: string;
								title: string;
								price: string;
								compareAtPrice: string | null;
								sku: string | null;
								barcode: string | null;
								inventoryQuantity: number;
								availableForSale: boolean;
								selectedOptions: Array<{
									name: string;
									value: string;
								}>;
								image: {
									url: string;
								} | null;
								weight: number | null;
								weightUnit: string | null;
								requiresShipping: boolean;
								position: number;
							};
						}>;
					};
				};
			}>;
			pageInfo: {
				hasNextPage: boolean;
				endCursor: string | null;
			};
		};
	};
	errors?: Array<{ message: string }>;
};

// ============================================================================
// Product Sync Types
// ============================================================================

export type ImportResult = {
	imported: number;
	skipped: number;
	errors: string[];
};

export type SyncResult = {
	updated: number;
	added: number;
	removed: number;
	errors: string[];
};

// ============================================================================
// Webhook Payload Types (REST API format)
// ============================================================================

export type ShopifyWebhookVariant = {
	id: number;
	title: string | null;
	price: string;
	sku: string | null;
	inventory_quantity: number;
};

export type ShopifyWebhookImage = {
	id: number;
	src: string;
	position: number;
};

export type ShopifyWebhookProduct = {
	id: number;
	title: string;
	body_html: string | null;
	status: "active" | "archived" | "draft";
	images: ShopifyWebhookImage[];
	variants: ShopifyWebhookVariant[];
};

export type ShopifyWebhookOrder = {
	id: number;
	name: string;
	financial_status:
		| "pending"
		| "paid"
		| "partially_paid"
		| "refunded"
		| "voided"
		| "partially_refunded";
	fulfillment_status: string | null;
	draft_order_id?: number;
	note?: string;
	tags?: string;
	total_price: string;
	customer?: {
		phone?: string;
		first_name?: string;
		last_name?: string;
	};
};

// ============================================================================
// Webhook Registration Types
// ============================================================================

export type ShopifyWebhookResponse = {
	webhook: {
		id: number;
		address: string;
		topic: string;
		created_at: string;
		updated_at: string;
		format: string;
		fields: string[];
		metafield_namespaces: string[];
		api_version: string;
		private_metafield_namespaces: string[];
	};
};

export type ShopifyWebhooksListResponse = {
	webhooks: Array<{
		id: number;
		address: string;
		topic: string;
	}>;
};

export type ShopifyWebhookErrorResponse = {
	errors?: Record<string, string[]> | string;
};

// ============================================================================
// Order Types
// ============================================================================

export type ShopifyDraftOrderResponse = {
	draft_order: {
		id: number;
		name: string;
		invoice_url: string;
		status: string;
		total_price: string;
		created_at: string;
	};
};

export type ShopifyOrderErrorResponse = {
	errors?: Record<string, string[]> | string;
};

export type CreateDraftOrderResult = {
	success: boolean;
	shopifyDraftOrderId: string | null;
	shopifyOrderNumber: string | null;
	invoiceUrl: string | null;
	error: string | null;
};
