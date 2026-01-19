import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "@echo/backend/convex/_generated/api";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProductForm from "@/components/products/ProductForm";
import BusinessSwitcher from "@/components/business-switcher";

export const Route = createFileRoute("/products/new")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Authenticated>
      <AddProductPageContent />
    </Authenticated>
  );
}

function AddProductPageContent() {
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

  const handleSuccess = () => {
    navigate({ to: "/products" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
          </div>
        </div>

        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/products" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add New Product</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm
              mode="create"
              businessId={activeBusinessId}
              onSuccess={handleSuccess}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
