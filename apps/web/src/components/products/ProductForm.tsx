import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriceInput } from "@/components/ui/PriceInput";
import ImageUpload from "@/components/ui/ImageUpload";

interface ProductFormProps {
  businessId: string;
  mode: "create" | "edit";
  productId?: Id<"products">;
  initialData?: {
    name: string;
    description?: string;
    price: number;
    categoryId?: string;
    imageId?: string;
  };
  onSuccess?: () => void;
}

export default function ProductForm({
  businessId,
  mode,
  productId,
  initialData,
  onSuccess,
}: ProductFormProps) {
  const categories = useQuery(api.categories.list, { businessId });
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);

  const business = useQuery(
    api.businesses.get,
    businessId ? { businessId: businessId as Id<"businesses"> } : "skip"
  );

  const productSchema = z.object({
    name: z.string().min(1, "Product name is required"),
    description: z.string(),
    price: z.number().min(1, "Price must be greater than 0"),
    categoryId: z.string(),
    imageId: z.string(),
  });

  const form = useForm({
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      price: initialData?.price || 0,
      categoryId: initialData?.categoryId || "",
      imageId: initialData?.imageId || "",
    },
    onSubmit: async ({ value }) => {
      try {
        const validated = productSchema.safeParse(value);

        if (!validated.success) {
          const firstError = validated.error.issues[0];
          toast.error(firstError.message);
          return;
        }

        if (mode === "create") {
          await createProduct({
            businessId,
            name: validated.data.name,
            description: validated.data.description || undefined,
            price: validated.data.price,
            categoryId: validated.data.categoryId || undefined,
            imageId: validated.data.imageId || undefined,
          });
          toast.success("Product created successfully");
        } else {
          if (!productId) {
            toast.error("Product ID is required for edit mode");
            return;
          }
          await updateProduct({
            productId,
            name: validated.data.name,
            description: validated.data.description || undefined,
            price: validated.data.price,
            categoryId: validated.data.categoryId || undefined,
            imageId: validated.data.imageId || undefined,
          });
          toast.success("Product updated successfully");
        }

        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save product");
      }
    },
  });

  const currency = business?.defaultLanguage === "es" ? "COP" : business?.defaultLanguage === "pt" ? "BRL" : "USD";

  if (categories === undefined || business === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "create" ? "Create Product" : "Edit Product"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  Product Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Product name"
                />
                {field.state.meta.errors.length > 0 &&
                  field.state.meta.errors.map((error, i) => (
                    <p key={i} className="text-sm text-red-500">
                      {String(error)}
                    </p>
                  ))}
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Description</Label>
                <textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Product description (optional)"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="price">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  Price <span className="text-red-500">*</span>
                </Label>
                <PriceInput
                  id={field.name}
                  name={field.name}
                  currency={currency}
                  value={field.state.value}
                  onChange={(valueInCents) => field.handleChange(valueInCents)}
                  placeholder="0.00"
                />
                {field.state.meta.errors.length > 0 &&
                  field.state.meta.errors.map((error, i) => (
                    <p key={i} className="text-sm text-red-500">
                      {String(error)}
                    </p>
                  ))}
              </div>
            )}
          </form.Field>

          <form.Field name="categoryId">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Category</Label>
                <select
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Select a category (optional)</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form.Field>

          <form.Field name="imageId">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Product Image</Label>
                <ImageUpload
                  value={field.state.value}
                  onChange={(storageId) => field.handleChange(storageId || "")}
                />
              </div>
            )}
          </form.Field>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {mode === "create" ? "Create Product" : "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
