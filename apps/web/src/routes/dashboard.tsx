import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { useEffect } from "react";

import SignInForm from "@/components/sign-in-form";
import UserMenu from "@/components/user-menu";
import BusinessSwitcher from "@/components/business-switcher";
import AppNav from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <Authenticated>
        <DashboardContent />
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

function DashboardContent() {
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Overview of your business profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium">Business Type</p>
              <p className="text-sm text-muted-foreground">
                {activeBusiness.type.charAt(0).toUpperCase() + activeBusiness.type.slice(1)}
              </p>
            </div>
            {activeBusiness.description && (
              <div>
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground">{activeBusiness.description}</p>
              </div>
            )}
            {activeBusiness.address && (
              <div>
                <p className="text-sm font-medium">Address</p>
                <p className="text-sm text-muted-foreground">{activeBusiness.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your business settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate({ to: "/settings" })}
              className="w-full"
              variant="outline"
            >
              Business Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
