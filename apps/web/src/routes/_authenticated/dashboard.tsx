import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  Circle,
  MessageSquare,
  Phone,
  Plus,
  Settings,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { ActivityItem } from "@/components/composed/ActivityItem";
import { MetricCard } from "@/components/composed/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function OnboardingItem({
  completed,
  label,
  href,
}: {
  completed: boolean;
  label: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
    >
      {completed ? (
        <CheckCircle2 className="h-5 w-5 text-success" />
      ) : (
        <Circle className="h-5 w-5 text-muted-foreground" />
      )}
      <span className={completed ? "text-muted-foreground line-through" : "text-sm"}>
        {label}
      </span>
    </Link>
  );
}

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
  const activity = useQuery(
    api.dashboard.getActivity,
    activeBusiness ? { businessId: activeBusiness._id, limit: 5 } : "skip"
  );
  const whatsappStatus = useQuery(
    api.integrations.whatsapp.settings.getConnectionStatus,
    activeBusiness ? { businessId: activeBusiness._id } : "skip"
  );
  const products = useQuery(
    api.products.list,
    activeBusiness ? { businessId: activeBusiness._id, limit: 1 } : "skip"
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates from your business</CardDescription>
              </div>
              <Link
                to="/conversations"
                className="text-sm text-primary hover:underline"
              >
                See all
              </Link>
            </CardHeader>
            <CardContent>
              {activity && activity.length > 0 ? (
                <div className="space-y-1">
                  {activity.map((item, index) => (
                    <ActivityItem
                      key={`${item.type}-${item.timestamp}-${index}`}
                      type={item.type}
                      description={item.description}
                      timestamp={item.timestamp}
                      link={item.link}
                      isEscalation={item.description.toLowerCase().includes("escalation")}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                  <p className="text-xs mt-1">
                    Activity will appear here when customers message you
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => navigate({ to: "/products/new" })}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
              <Button
                onClick={() => navigate({ to: "/settings" })}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              {whatsappStatus && !whatsappStatus.connected && (
                <Button
                  onClick={() => navigate({ to: "/settings/whatsapp" })}
                  className="w-full justify-start gap-2"
                  variant="default"
                >
                  <Phone className="h-4 w-4" />
                  Connect WhatsApp
                </Button>
              )}
            </CardContent>
          </Card>

          {(!products?.products?.length || !whatsappStatus?.connected) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Getting Started</CardTitle>
                <CardDescription>Complete these steps to get up and running</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <OnboardingItem
                  completed={true}
                  label="Create your business"
                  href="/settings"
                />
                <OnboardingItem
                  completed={(products?.products?.length ?? 0) > 0}
                  label="Add your first product"
                  href="/products/new"
                />
                <OnboardingItem
                  completed={whatsappStatus?.connected ?? false}
                  label="Connect WhatsApp"
                  href="/settings/whatsapp"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
