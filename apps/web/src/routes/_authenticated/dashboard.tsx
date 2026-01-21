import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { MessageSquare, ShoppingCart, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";

import { MetricCard } from "@/components/composed/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function DashboardPage() {
  const navigate = useNavigate();
  const businesses = useQuery(api.businesses.list);
  const user = useQuery(api.auth.getCurrentUser);

  const activeBusiness = businesses?.[0];
  const metrics = useQuery(
    api.dashboard.getMetrics,
    activeBusiness ? { businessId: activeBusiness._id } : "skip"
  );

  if (businesses === undefined || user === undefined) {
    return null;
  }

  if (!activeBusiness) {
    return null;
  }

  const greeting = getGreeting();
  const userName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="container mx-auto max-w-7xl py-8 px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-heading">
          {greeting}, {userName}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's what's happening at {activeBusiness.name}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <MetricCard
          title="Conversations"
          value={metrics?.activeConversations ?? 0}
          subtitle={
            metrics?.escalatedCount
              ? `${metrics.escalatedCount} escalated`
              : "All handled by AI"
          }
          icon={MessageSquare}
          link="/conversations"
          variant={metrics?.escalatedCount ? "warning" : "default"}
        />

        <MetricCard
          title="Orders Today"
          value={metrics?.ordersToday ?? 0}
          subtitle={formatCurrency(metrics?.revenueToday ?? 0)}
          icon={ShoppingCart}
          link="/orders"
        />

        <MetricCard
          title="Weekly Conversations"
          value={metrics?.weeklyConversations ?? 0}
          subtitle={
            metrics?.weeklyChange !== undefined
              ? `${metrics.weeklyChange >= 0 ? "+" : ""}${metrics.weeklyChange}% from last week`
              : undefined
          }
          icon={metrics?.weeklyChange && metrics.weeklyChange < 0 ? TrendingDown : TrendingUp}
        />
      </div>

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
          <CardContent className="space-y-3">
            <Button
              onClick={() => navigate({ to: "/products/new" })}
              className="w-full justify-between"
              variant="outline"
            >
              Add Product
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => navigate({ to: "/settings" })}
              className="w-full justify-between"
              variant="outline"
            >
              Business Settings
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
