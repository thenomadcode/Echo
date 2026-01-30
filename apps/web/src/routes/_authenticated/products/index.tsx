import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	CheckCircle,
	FolderOpen,
	Grid,
	List,
	Loader2,
	Plus,
	Settings,
	ShoppingBag,
	Trash2,
	X,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ProductCard } from "@/components/products/product-card";
import { ProductTable } from "@/components/products/product-table";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/products/")({
	component: ProductsPageContent,
});

function ProductsPageContent() {
	const navigate = useNavigate();
	const businesses = useQuery(api.businesses.list, {});

	const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

	useEffect(() => {
		if (businesses === undefined) return;

		if (businesses.length === 0) {
			navigate({ to: "/onboarding" });
			return;
		}

		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("echo:activeBusinessId");
			if (stored && businesses.find((b) => b._id === stored)) {
				setActiveBusinessId(stored);
			} else {
				setActiveBusinessId(businesses[0]?._id || null);
			}
		}
	}, [businesses, navigate]);

	if (businesses === undefined || !activeBusinessId) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	return <ProductsPage businessId={activeBusinessId} />;
}

type ViewMode = "grid" | "table";
type AvailabilityFilter = "all" | "available" | "unavailable";

interface ProductsPageProps {
	businessId: string;
}

function ProductsPage({ businessId }: ProductsPageProps) {
	const navigate = useNavigate();
	const productsData = useQuery(api.products.list, {
		businessId,
		limit: 100,
	});
	const categories = useQuery(api.categories.list, { businessId });
	const bulkUpdateAvailability = useMutation(api.products.bulkUpdateAvailability);
	const bulkDelete = useMutation(api.products.bulkDelete);
	const bulkUpdateCategory = useMutation(api.products.bulkUpdateCategory);

	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [searchQuery, setSearchQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
	const [selectedProducts, setSelectedProducts] = useState<Set<Id<"products">>>(new Set());
	const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
	const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);

	const products = productsData?.products || [];

	const filteredProducts = useMemo(() => {
		let filtered = [...products];

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query),
			);
		}

		if (categoryFilter !== "all") {
			if (categoryFilter === "uncategorized") {
				filtered = filtered.filter((p) => !p.categoryId);
			} else {
				filtered = filtered.filter((p) => p.categoryId === categoryFilter);
			}
		}

		if (availabilityFilter !== "all") {
			filtered = filtered.filter((p) =>
				availabilityFilter === "available" ? p.available : !p.available,
			);
		}

		return filtered;
	}, [products, searchQuery, categoryFilter, availabilityFilter]);

	const handleSelectProduct = (productId: Id<"products">, selected: boolean) => {
		setSelectedProducts((prev) => {
			const next = new Set(prev);
			if (selected) {
				next.add(productId);
			} else {
				next.delete(productId);
			}
			return next;
		});
	};

	const handleSelectAll = (selected: boolean) => {
		if (selected) {
			setSelectedProducts(new Set(filteredProducts.map((p) => p._id)));
		} else {
			setSelectedProducts(new Set());
		}
	};

	const handleClearSelection = () => {
		setSelectedProducts(new Set());
	};

	const handleBulkMarkAvailable = async () => {
		setIsBulkActionRunning(true);
		try {
			const productIds = Array.from(selectedProducts);
			const count = await bulkUpdateAvailability({ productIds, available: true });
			toast.success(`${count} product${count === 1 ? "" : "s"} marked as available`);
			setSelectedProducts(new Set());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update products");
		} finally {
			setIsBulkActionRunning(false);
		}
	};

	const handleBulkMarkUnavailable = async () => {
		setIsBulkActionRunning(true);
		try {
			const productIds = Array.from(selectedProducts);
			const count = await bulkUpdateAvailability({ productIds, available: false });
			toast.success(`${count} product${count === 1 ? "" : "s"} marked as unavailable`);
			setSelectedProducts(new Set());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update products");
		} finally {
			setIsBulkActionRunning(false);
		}
	};

	const handleBulkDelete = async () => {
		setIsBulkActionRunning(true);
		try {
			const productIds = Array.from(selectedProducts);
			const count = await bulkDelete({ productIds });
			toast.success(`${count} product${count === 1 ? "" : "s"} deleted`);
			setSelectedProducts(new Set());
			setShowBulkDeleteConfirm(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete products");
		} finally {
			setIsBulkActionRunning(false);
		}
	};

	const handleBulkChangeCategory = async (categoryId: string) => {
		setIsBulkActionRunning(true);
		try {
			const productIds = Array.from(selectedProducts);
			const count = await bulkUpdateCategory({
				productIds,
				categoryId: categoryId === "none" ? undefined : categoryId,
			});
			const categoryName =
				categoryId === "none"
					? "uncategorized"
					: categories?.find((c) => c._id === categoryId)?.name || "category";
			toast.success(`${count} product${count === 1 ? "" : "s"} moved to ${categoryName}`);
			setSelectedProducts(new Set());
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update products");
		} finally {
			setIsBulkActionRunning(false);
		}
	};

	return (
		<div className="container mx-auto max-w-7xl p-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Products</CardTitle>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => navigate({ to: "/products/categories" })}
							>
								<Settings className="mr-2 h-4 w-4" />
								Manage Categories
							</Button>
							<Button size="sm" onClick={() => navigate({ to: "/products/new" })}>
								<Plus className="mr-2 h-4 w-4" />
								Add Product
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					<div className="mb-6 space-y-4">
						<div className="flex flex-col gap-4 md:flex-row md:items-end">
							<div className="flex-1 space-y-2">
								<Label htmlFor="search">Search</Label>
								<Input
									id="search"
									type="text"
									placeholder="Search products..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
								/>
							</div>

							<div className="space-y-2 md:w-48">
								<Label htmlFor="category">Category</Label>
								<Select
									value={categoryFilter}
									onValueChange={(value) => value && setCategoryFilter(value)}
								>
									<SelectTrigger className="h-9 w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Categories</SelectItem>
										<SelectItem value="uncategorized">Uncategorized</SelectItem>
										{categories?.map((cat) => (
											<SelectItem key={cat._id} value={cat._id}>
												{cat.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2 md:w-48">
								<Label htmlFor="availability">Availability</Label>
								<Select
									value={availabilityFilter}
									onValueChange={(value) =>
										value && setAvailabilityFilter(value as AvailabilityFilter)
									}
								>
									<SelectTrigger className="h-9 w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Products</SelectItem>
										<SelectItem value="available">Available Only</SelectItem>
										<SelectItem value="unavailable">Unavailable Only</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="flex gap-2">
								<Button
									variant={viewMode === "grid" ? "default" : "outline"}
									size="icon"
									onClick={() => setViewMode("grid")}
								>
									<Grid className="h-4 w-4" />
								</Button>
								<Button
									variant={viewMode === "table" ? "default" : "outline"}
									size="icon"
									onClick={() => setViewMode("table")}
								>
									<List className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>

					{filteredProducts.length === 0 ? (
						products.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-16 text-center">
								<div className="mb-6 rounded-full bg-muted p-8">
									<ShoppingBag className="h-12 w-12 text-muted-foreground" />
								</div>
								<h3 className="mb-3 font-semibold text-xl">Add your first product</h3>
								<p className="mb-6 max-w-[360px] text-muted-foreground text-sm">
									Products you add will be available for customers to order through WhatsApp
								</p>
								<Button size="lg" onClick={() => navigate({ to: "/products/new" })}>
									<Plus className="mr-2 h-5 w-5" />
									Add Product
								</Button>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<div className="mb-4 rounded-full bg-muted p-6">
									<Plus className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="mb-2 font-semibold text-lg">No products found</h3>
								<p className="text-muted-foreground text-sm">
									Try adjusting your filters or search query
								</p>
							</div>
						)
					) : viewMode === "grid" ? (
						<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{filteredProducts.map((product) => (
								<ProductCard
									key={product._id}
									productId={product._id}
									businessId={businessId}
									name={product.name}
									price={product.price}
									currency={product.currency}
									categoryId={product.categoryId}
									imageId={product.imageId}
									available={product.available}
									selected={selectedProducts.has(product._id)}
									onSelectChange={(selected) => handleSelectProduct(product._id, selected)}
									hasVariants={product.hasVariants}
									variantCount={product.variantCount}
									minPrice={product.minPrice}
									maxPrice={product.maxPrice}
								/>
							))}
						</div>
					) : (
						<ProductTable
							products={filteredProducts}
							businessId={businessId}
							selectedProducts={selectedProducts}
							onSelectProduct={handleSelectProduct}
							onSelectAll={handleSelectAll}
						/>
					)}
				</CardContent>
			</Card>

			{selectedProducts.size > 0 && (
				<div className="slide-in-from-bottom fixed right-0 bottom-0 left-0 z-50 animate-in border-t bg-background shadow-lg duration-300">
					<div className="container mx-auto max-w-7xl px-6 py-4">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div className="flex items-center gap-4">
								<Button
									variant="ghost"
									size="icon"
									onClick={handleClearSelection}
									disabled={isBulkActionRunning}
									className="h-8 w-8"
								>
									<X className="h-4 w-4" />
								</Button>
								<span className="font-medium">{selectedProducts.size} selected</span>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={handleBulkMarkAvailable}
									disabled={isBulkActionRunning}
								>
									<CheckCircle className="mr-2 h-4 w-4" />
									Mark Available
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleBulkMarkUnavailable}
									disabled={isBulkActionRunning}
								>
									<XCircle className="mr-2 h-4 w-4" />
									Mark Unavailable
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => setShowBulkDeleteConfirm(true)}
									disabled={isBulkActionRunning}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</Button>
								<div className="flex items-center gap-2">
									<FolderOpen className="h-4 w-4 text-muted-foreground" />
									<Select
										value=""
										onValueChange={(value) => value && handleBulkChangeCategory(value)}
										disabled={isBulkActionRunning}
									>
										<SelectTrigger className="h-9 w-auto min-w-[120px]">
											<SelectValue placeholder="Move to..." />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">Uncategorized</SelectItem>
											{categories?.map((cat) => (
												<SelectItem key={cat._id} value={cat._id}>
													{cat.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			<AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Products</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete {selectedProducts.size} product
							{selectedProducts.size === 1 ? "" : "s"}? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isBulkActionRunning}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleBulkDelete}
							disabled={isBulkActionRunning}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isBulkActionRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete Products
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
