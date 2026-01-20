import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProductForm from "@/components/products/ProductForm";
import BusinessSwitcher from "@/components/business-switcher";
import AppNav from "@/components/app-nav";
import UserMenu from "@/components/user-menu";

export const Route = createFileRoute("/products/$productId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { productId } = Route.useParams();
  
  return (
    <Authenticated>
      <EditProductPageContent productId={productId as Id<"products">} />
    </Authenticated>
  );
}

interface EditProductPageContentProps {
  productId: Id<"products">;
}

function EditProductPageContent({ productId }: EditProductPageContentProps) {
  const navigate = useNavigate();
  const product = useQuery(api.products.get, { productId });
  const deleteProduct = useMutation(api.products.deleteProduct);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (product === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Product not found</div>
      </div>
    );
  }

  const handleSuccess = () => {
    navigate({ to: "/products" });
  };

  const handleCancel = () => {
    navigate({ to: "/products" });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProduct({ productId });
      toast.success("Product deleted successfully");
      navigate({ to: "/products" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete product");
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
            <AppNav />
          </div>
          <UserMenu />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/products" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Product
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Edit Product</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm
              mode="edit"
              businessId={product.businessId}
              productId={productId}
              initialData={{
                name: product.name,
                description: product.description,
                price: product.price,
                categoryId: product.categoryId,
                imageId: product.imageId,
              }}
              onSuccess={handleSuccess}
            />
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Delete Product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete "{product.name}"? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
