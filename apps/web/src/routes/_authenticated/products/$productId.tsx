import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ProductForm from "@/components/products/ProductForm";
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

export const Route = createFileRoute("/_authenticated/products/$productId")({
  component: EditProductPageContent,
});

function EditProductPageContent() {
  const navigate = useNavigate();
  const { productId } = Route.useParams();
  const product = useQuery(api.products.get, { productId: productId as Id<"products"> });
  const deleteProduct = useMutation(api.products.deleteProduct);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (product === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="flex h-64 items-center justify-center">
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
      await deleteProduct({ productId: productId as Id<"products"> });
      toast.success("Product deleted successfully");
      navigate({ to: "/products" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete product");
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
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
            productId={productId as Id<"products">}
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
