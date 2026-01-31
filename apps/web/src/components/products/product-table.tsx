import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronRight, ChevronUp, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCurrency, getPriceRange, getTotalStock } from "@/lib/formatting";
import { cn } from "@/lib/utils";

interface ProductVariant {
	_id: Id<"productVariants">;
	name: string;
	price: number;
	inventoryQuantity: number;
	sku?: string;
	available: boolean;
	option1Name?: string;
	option1Value?: string;
	option2Name?: string;
	option2Value?: string;
	option3Name?: string;
	option3Value?: string;
	weight?: number;
	weightUnit?: "kg" | "g" | "lb" | "oz";
}

interface Product {
	_id: Id<"products">;
	businessId: string;
	name: string;
	price: number;
	currency: string;
	categoryId?: string;
	imageId?: string;
	available: boolean;
	hasVariants: boolean;
	variants: ProductVariant[];
	variantCount: number;
}

interface ProductTableProps {
	products: Product[];
	businessId: string;
	selectedProducts?: Set<Id<"products">>;
	onSelectProduct?: (productId: Id<"products">, selected: boolean) => void;
	onSelectAll?: (selected: boolean) => void;
}

interface ProductTableRowProps {
	product: Product;
	categoryName: string;
	isSelected: boolean;
	isExpanded: boolean;
	onExpandToggle: () => void;
	onRowClick: () => void;
	onCheckboxChange: (checked: boolean | "indeterminate") => void;
	onAvailabilityToggle: (checked: boolean) => void;
}

type SortField = "name" | "price" | "category";
type SortOrder = "asc" | "desc";

function ProductTableRow({
	product,
	categoryName,
	isSelected,
	isExpanded,
	onExpandToggle,
	onRowClick,
	onCheckboxChange,
	onAvailabilityToggle,
}: ProductTableRowProps) {
	const imageUrl = useQuery(
		api.products.getImageUrl,
		product.imageId ? { storageId: product.imageId } : "skip",
	);

	const currency = product.currency as "COP" | "BRL" | "MXN" | "USD";
	const priceDisplay = product.hasVariants
		? getPriceRange(product.variants, currency)
		: formatCurrency(product.price, currency);
	const totalStock = getTotalStock(product.variants);

	return (
		<>
			<TableRow
				className={cn("cursor-pointer", !product.available && "text-muted-foreground opacity-60")}
				onClick={onRowClick}
			>
				<TableCell onClick={(e) => e.stopPropagation()}>
					<Checkbox checked={isSelected} onCheckedChange={onCheckboxChange} />
				</TableCell>
				<TableCell onClick={(e) => e.stopPropagation()}>
					{product.hasVariants && product.variantCount > 0 && (
						<button
							type="button"
							className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
							onClick={(e) => {
								e.stopPropagation();
								onExpandToggle();
							}}
						>
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</button>
					)}
				</TableCell>
				<TableCell>
					{imageUrl ? (
						<img src={imageUrl} alt={product.name} className="h-12 w-12 rounded object-cover" />
					) : (
						<div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
							<span className="text-muted-foreground text-xs">No img</span>
						</div>
					)}
				</TableCell>
				<TableCell className="font-medium">
					<div className="flex items-center gap-2">
						<span>{product.name}</span>
						{product.hasVariants && product.variantCount > 0 && (
							<Badge variant="secondary" className="text-xs">
								{product.variantCount} variant{product.variantCount === 1 ? "" : "s"}
							</Badge>
						)}
					</div>
				</TableCell>
				<TableCell>{priceDisplay}</TableCell>
				<TableCell>
					<span className={cn(totalStock === 0 && "text-destructive")}>{totalStock} in stock</span>
				</TableCell>
				<TableCell>{categoryName}</TableCell>
				<TableCell onClick={(e) => e.stopPropagation()}>
					<Switch checked={product.available} onCheckedChange={onAvailabilityToggle} />
				</TableCell>
			</TableRow>
			{isExpanded &&
				product.hasVariants &&
				product.variantCount > 0 &&
				product.variants.map((variant) => (
					<TableRow key={variant._id} className="bg-muted/30 hover:bg-muted/50">
						<TableCell />
						<TableCell />
						<TableCell />
						<TableCell className="pl-8">
							<div className="flex items-center gap-2">
								<Package className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm">{variant.name}</span>
								{variant.sku && (
									<span className="text-muted-foreground text-xs">SKU: {variant.sku}</span>
								)}
							</div>
						</TableCell>
						<TableCell className="text-sm">{formatCurrency(variant.price, currency)}</TableCell>
						<TableCell className="text-sm">
							<span className={cn(variant.inventoryQuantity === 0 && "text-destructive")}>
								{variant.inventoryQuantity} in stock
							</span>
						</TableCell>
						<TableCell />
						<TableCell>
							<Badge variant={variant.available ? "success" : "secondary"} className="text-xs">
								{variant.available ? "Available" : "Unavailable"}
							</Badge>
						</TableCell>
					</TableRow>
				))}
		</>
	);
}

export function ProductTable({
	products,
	businessId,
	selectedProducts = new Set(),
	onSelectProduct,
	onSelectAll,
}: ProductTableProps) {
	const navigate = useNavigate();
	const updateProduct = useMutation(api.products.update);
	const categories = useQuery(api.categories.list, { businessId });

	const [sortField, setSortField] = useState<SortField>("name");
	const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
	const [expandedRows, setExpandedRows] = useState<Set<Id<"products">>>(new Set());

	const handleExpandToggle = (productId: Id<"products">) => {
		setExpandedRows((prev) => {
			const next = new Set(prev);
			if (next.has(productId)) {
				next.delete(productId);
			} else {
				next.add(productId);
			}
			return next;
		});
	};

	const allSelected = products.length > 0 && products.every((p) => selectedProducts.has(p._id));

	const handleRowClick = (productId: Id<"products">) => {
		navigate({ to: `/products/${productId}` });
	};

	const handleAvailabilityToggle = async (productId: Id<"products">, checked: boolean) => {
		try {
			await updateProduct({
				productId,
				available: checked,
			});
			toast.success(checked ? "Product marked as available" : "Product marked as unavailable");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update availability");
		}
	};

	const handleCheckboxChange = (productId: Id<"products">, checked: boolean | "indeterminate") => {
		if (onSelectProduct && typeof checked === "boolean") {
			onSelectProduct(productId, checked);
		}
	};

	const handleSelectAllChange = (checked: boolean | "indeterminate") => {
		if (onSelectAll && typeof checked === "boolean") {
			onSelectAll(checked);
		}
	};

	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortOrder("asc");
		}
	};

	const getCategoryName = (categoryId?: string) => {
		if (!categoryId || !categories) return "";
		const category = categories.find((c) => c._id === categoryId);
		return category?.name || "";
	};

	const sortedProducts = [...products].sort((a, b) => {
		let compareValue = 0;

		if (sortField === "name") {
			compareValue = a.name.localeCompare(b.name);
		} else if (sortField === "price") {
			compareValue = a.price - b.price;
		} else if (sortField === "category") {
			const catA = getCategoryName(a.categoryId);
			const catB = getCategoryName(b.categoryId);
			compareValue = catA.localeCompare(catB);
		}

		return sortOrder === "asc" ? compareValue : -compareValue;
	});

	const SortIcon = ({ field }: { field: SortField }) => {
		if (sortField !== field) return null;
		return sortOrder === "asc" ? (
			<ChevronUp className="ml-1 inline h-4 w-4" />
		) : (
			<ChevronDown className="ml-1 inline h-4 w-4" />
		);
	};

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12">
							<Checkbox checked={allSelected} onCheckedChange={handleSelectAllChange} />
						</TableHead>
						<TableHead className="w-12" />
						<TableHead className="w-20">Image</TableHead>
						<TableHead
							className="cursor-pointer hover:bg-muted/50"
							onClick={() => handleSort("name")}
						>
							Name
							<SortIcon field="name" />
						</TableHead>
						<TableHead
							className="cursor-pointer hover:bg-muted/50"
							onClick={() => handleSort("price")}
						>
							Price
							<SortIcon field="price" />
						</TableHead>
						<TableHead>Stock</TableHead>
						<TableHead
							className="cursor-pointer hover:bg-muted/50"
							onClick={() => handleSort("category")}
						>
							Category
							<SortIcon field="category" />
						</TableHead>
						<TableHead className="w-32">Availability</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{sortedProducts.length === 0 ? (
						<TableRow>
							<TableCell colSpan={8} className="h-24 text-center">
								No products found.
							</TableCell>
						</TableRow>
					) : (
						sortedProducts.map((product) => (
							<ProductTableRow
								key={product._id}
								product={product}
								categoryName={getCategoryName(product.categoryId)}
								isSelected={selectedProducts.has(product._id)}
								isExpanded={expandedRows.has(product._id)}
								onExpandToggle={() => handleExpandToggle(product._id)}
								onRowClick={() => handleRowClick(product._id)}
								onCheckboxChange={(checked) => handleCheckboxChange(product._id, checked)}
								onAvailabilityToggle={(checked) => handleAvailabilityToggle(product._id, checked)}
							/>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}
