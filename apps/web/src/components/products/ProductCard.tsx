import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  productId: Id<"products">;
  businessId: string;
  name: string;
  price: number;
  currency: string;
  categoryId?: string;
  imageId?: string;
  available: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

const CURRENCY_LOCALES: Record<string, string> = {
  COP: "es-CO",
  BRL: "pt-BR",
  MXN: "es-MX",
  USD: "en-US",
};

function formatPrice(price: number, currency: string): string {
  const locale = CURRENCY_LOCALES[currency] || "en-US";
  const valueInMajorUnits = price / 100;
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valueInMajorUnits);
}

export default function ProductCard({
  productId,
  businessId,
  name,
  price,
  currency,
  categoryId,
  imageId,
  available,
  selected = false,
  onSelectChange,
}: ProductCardProps) {
  const navigate = useNavigate();
  const updateProduct = useMutation(api.products.update);
  const categories = useQuery(api.categories.list, { businessId });
  const imageUrl = useQuery(
    api.products.getImageUrl,
    imageId ? { storageId: imageId } : "skip"
  );

  const category = categories?.find((c) => c._id === categoryId);

  const handleCardClick = () => {
    navigate({ to: `/products/${productId}` });
  };

  const handleAvailabilityToggle = async (checked: boolean) => {
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

  const handleCheckboxChange = (checked: boolean | "indeterminate") => {
    if (onSelectChange && typeof checked === "boolean") {
      onSelectChange(checked);
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        !available && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={handleCheckboxChange}
            />
          </div>

          <div className="flex-1" onClick={handleCardClick}>
            <div className="mb-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={name}
                  className="h-40 w-full rounded-md object-cover"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-md bg-muted">
                  <span className="text-muted-foreground text-sm">No image</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h3 className={cn("font-medium", !available && "text-muted-foreground")}>
                {name}
              </h3>
              <p className="text-lg font-semibold">{formatPrice(price, currency)}</p>
              {category && (
                <p className="text-sm text-muted-foreground">{category.name}</p>
              )}
              {!available && (
                <div className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  Unavailable
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="mt-3 flex items-center justify-between pt-3 border-t"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <span className="text-sm text-muted-foreground">Available</span>
          <Switch
            checked={available}
            onCheckedChange={handleAvailabilityToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
