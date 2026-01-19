import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Product {
  _id: Id<"products">;
  businessId: string;
  name: string;
  price: number;
  currency: string;
  categoryId?: string;
  imageId?: string;
  available: boolean;
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
  onRowClick: () => void;
  onCheckboxChange: (checked: boolean | "indeterminate") => void;
  onAvailabilityToggle: (checked: boolean) => void;
}

type SortField = "name" | "price" | "category";
type SortOrder = "asc" | "desc";

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

function ProductTableRow({
  product,
  categoryName,
  isSelected,
  onRowClick,
  onCheckboxChange,
  onAvailabilityToggle,
}: ProductTableRowProps) {
  const imageUrl = useQuery(
    api.products.getImageUrl,
    product.imageId ? { storageId: product.imageId } : "skip"
  );

  return (
    <TableRow
      className={cn(
        "cursor-pointer",
        !product.available && "opacity-60 text-muted-foreground"
      )}
      onClick={onRowClick}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onCheckboxChange}
        />
      </TableCell>
      <TableCell>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-12 w-12 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
            <span className="text-xs text-muted-foreground">No img</span>
          </div>
        )}
      </TableCell>
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell>{formatPrice(product.price, product.currency)}</TableCell>
      <TableCell>{categoryName}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={product.available}
          onCheckedChange={onAvailabilityToggle}
        />
      </TableCell>
    </TableRow>
  );
}

export default function ProductTable({
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

  const allSelected = products.length > 0 && products.every((p) => selectedProducts.has(p._id));

  const handleRowClick = (productId: Id<"products">) => {
    navigate({ to: `/products/${productId}` });
  };

  const handleAvailabilityToggle = async (
    productId: Id<"products">,
    checked: boolean
  ) => {
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

  const handleCheckboxChange = (
    productId: Id<"products">,
    checked: boolean | "indeterminate"
  ) => {
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
      <ChevronUp className="ml-1 h-4 w-4 inline" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4 inline" />
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAllChange}
              />
            </TableHead>
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
              <TableCell colSpan={6} className="h-24 text-center">
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
