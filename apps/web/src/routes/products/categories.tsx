import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

import CategoryManager from "@/components/products/CategoryManager";
import SignInForm from "@/components/sign-in-form";
import UserMenu from "@/components/user-menu";
import BusinessSwitcher from "@/components/business-switcher";
import AppNav from "@/components/app-nav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/products/categories")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <Authenticated>
        <CategoriesContent />
      </Authenticated>
      <Unauthenticated>
        <div className="mx-auto mt-10 max-w-md p-6">
          <SignInForm />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <div>Loading...</div>
        </div>
      </AuthLoading>
    </>
  );
}

function CategoriesContent() {
  const navigate = useNavigate();
  const businesses = useQuery(api.businesses.list);

  useEffect(() => {
    if (businesses !== undefined && businesses.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [businesses, navigate]);

  if (businesses === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading your businesses...</div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  const activeBusiness = businesses[0];

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <BusinessSwitcher />
          <AppNav />
        </div>
        <UserMenu />
      </div>

      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/products" })}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <h1 className="text-3xl font-bold">Manage Categories</h1>
        <p className="text-muted-foreground mt-2">
          Organize your products into categories
        </p>
      </div>

      <CategoryManager businessId={activeBusiness._id} />
    </div>
  );
}
