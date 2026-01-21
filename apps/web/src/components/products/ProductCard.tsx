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
        "cursor-pointer transition-all hover:shadow-md overflow-hidden",
        selected && "ring-2 ring-primary"
      )}
    >
      <div className="relative">
        <div
          className="absolute top-3 left-3 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={handleCheckboxChange}
            className="bg-background"
          />
        </div>
        <div
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
          style={{
            backgroundColor: available ? "rgb(34, 197, 94)" : "rgb(156, 163, 175)",
            color: "white",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "white" }}
          />
          {available ? "Available" : "Unavailable"}
        </div>
        <div onClick={handleCardClick}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-muted">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-4" onClick={handleCardClick}>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight line-clamp-2">
              {name}
            </h3>
          </div>
          <p className="text-lg font-bold text-primary">{formatPrice(price, currency)}</p>
          {category && (
            <p className="text-sm text-muted-foreground">{category.name}</p>
          )}
        </div>
      </CardContent>

      <div
        className="px-4 pb-4 pt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-sm text-muted-foreground">Toggle availability</span>
          <Switch
            checked={available}
            onCheckedChange={handleAvailabilityToggle}
          />
        </div>
      </div>
    </Card>
  );
}
