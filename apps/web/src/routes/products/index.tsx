import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import { Grid, List, Plus, Settings, CheckCircle, XCircle, Trash2, FolderOpen } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProductCard from "@/components/products/ProductCard";
import ProductTable from "@/components/products/ProductTable";
import BusinessSwitcher from "@/components/business-switcher";
import AppNav from "@/components/app-nav";
import UserMenu from "@/components/user-menu";

export const Route = createFileRoute("/products/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Authenticated>
      <ProductsPageContent />
    </Authenticated>
  );
}

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
      <div className="flex h-screen items-center justify-center">
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
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
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
        availabilityFilter === "available" ? p.available : !p.available
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
            <AppNav />
          </div>
          <UserMenu />
        </div>

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
                <Button
                  size="sm"
                  onClick={() => navigate({ to: "/products/new" })}
                >
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
                  <select
                    id="category"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="all">All Categories</option>
                    <option value="uncategorized">Uncategorized</option>
                    {categories?.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:w-48">
                  <Label htmlFor="availability">Availability</Label>
                  <select
                    id="availability"
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value as AvailabilityFilter)}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="all">All Products</option>
                    <option value="available">Available Only</option>
                    <option value="unavailable">Unavailable Only</option>
                  </select>
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

              {selectedProducts.size > 0 && (
                <div className="rounded-md border border-primary bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {selectedProducts.size} product{selectedProducts.size === 1 ? "" : "s"} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearSelection}
                      disabled={isBulkActionRunning}
                    >
                      Clear Selection
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                      <select
                        value=""
                        onChange={(e) => handleBulkChangeCategory(e.target.value)}
                        disabled={isBulkActionRunning}
                        className="flex h-8 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="" disabled>
                          Change Category
                        </option>
                        <option value="none">Uncategorized</option>
                        {categories?.map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-muted p-6">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No products found</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  {products.length === 0
                    ? "Get started by creating your first product"
                    : "Try adjusting your filters or search query"}
                </p>
                {products.length === 0 && (
                  <Button onClick={() => navigate({ to: "/products/new" })}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Product
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      </div>

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete {selectedProducts.size} product
                {selectedProducts.size === 1 ? "" : "s"}? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  disabled={isBulkActionRunning}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isBulkActionRunning}
                >
                  {isBulkActionRunning ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
