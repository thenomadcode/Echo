import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery as useConvexQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

import SignInForm from "@/components/sign-in-form";
import BusinessSwitcher from "@/components/business-switcher";
import AppNav from "@/components/app-nav";
import UserMenu from "@/components/user-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/orders/")({
  component: RouteComponent,
});

type OrderStatus = "draft" | "confirmed" | "paid" | "preparing" | "ready" | "delivered" | "cancelled";

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-700 border-blue-200" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700 border-green-200" },
  preparing: { label: "Preparing", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  ready: { label: "Ready", className: "bg-orange-100 text-orange-700 border-orange-200" },
  delivered: { label: "Delivered", className: "bg-teal-100 text-teal-700 border-teal-200" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

function RouteComponent() {
  return (
    <>
      <Authenticated>
        <OrdersPageContent />
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

function OrdersPageContent() {
  const navigate = useNavigate();
  const businesses = useConvexQuery(api.businesses.list, {});

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

  return <OrdersPage businessId={activeBusinessId as Id<"businesses">} />;
}

interface OrdersPageProps {
  businessId: Id<"businesses">;
}

function OrdersPage({ businessId }: OrdersPageProps) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  const ordersQuery = useQuery(
    convexQuery(api.orders.listByBusiness, {
      businessId,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 50,
    })
  );

  const orders = ordersQuery.data?.orders ?? [];

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const handleRowClick = (orderId: Id<"orders">) => {
    window.location.href = `/dashboard/orders/${orderId}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
            <AppNav />
          </div>
          <UserMenu />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Orders</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="space-y-2 md:w-48">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="all">All</option>
                    <option value="draft">Draft</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="paid">Paid</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {ordersQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading orders...</div>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-muted p-6">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No orders yet</h3>
                <p className="text-sm text-muted-foreground">
                  Orders will appear here when customers place them via WhatsApp
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order._id}
                      onClick={() => handleRowClick(order._id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">{order.orderNumber}</TableCell>
                      <TableCell>
                        <StatusBadge status={order.status as OrderStatus} />
                      </TableCell>
                      <TableCell className="text-center">{order.items.length}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(order.total, order.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDate(order.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
