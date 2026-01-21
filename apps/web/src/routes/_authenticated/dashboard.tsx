import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const businesses = useQuery(api.businesses.list);

  if (businesses === undefined) {
    return null;
  }

  const activeBusiness = businesses[0];

  if (!activeBusiness) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl py-8 px-6">
      <h1 className="text-2xl font-bold font-heading mb-6">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Overview of your business profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Business Name</p>
              <p className="text-sm text-muted-foreground">{activeBusiness.name}</p>
            </div>
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
