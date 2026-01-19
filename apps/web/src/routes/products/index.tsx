import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import { Grid, List, Plus, Settings } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProductCard from "@/components/products/ProductCard";
import ProductTable from "@/components/products/ProductTable";
import BusinessSwitcher from "@/components/business-switcher";

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

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [selectedProducts, setSelectedProducts] = useState<Set<Id<"products">>>(new Set());

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
          </div>
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
                <div className="flex items-center justify-between rounded-md border border-primary bg-primary/5 p-3">
                  <span className="text-sm font-medium">
                    {selectedProducts.size} product{selectedProducts.size === 1 ? "" : "s"} selected
                  </span>
                  <Button variant="outline" size="sm" onClick={handleClearSelection}>
                    Clear Selection
                  </Button>
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
    </div>
  );
}
