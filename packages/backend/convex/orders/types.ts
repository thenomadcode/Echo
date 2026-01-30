export type OrderItem = {
	productId: string;
	variantId?: string;
	name: string;
	variantName?: string;
	sku?: string;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
};
