import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

import { StatusBadge } from "@/components/composed/StatusBadge";
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

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
});

type OrderStatus = "draft" | "confirmed" | "paid" | "preparing" | "ready" | "delivered" | "cancelled";

function OrdersPage() {
  const businesses = useConvexQuery(api.businesses.list, {});

  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (businesses === undefined) return;

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("echo:activeBusinessId");
      if (stored && businesses.find((b) => b._id === stored)) {
        setActiveBusinessId(stored);
      } else {
        setActiveBusinessId(businesses[0]?._id || null);
      }
    }
  }, [businesses]);

  if (businesses === undefined || !activeBusinessId) {
    return null;
  }

  return <OrdersContent businessId={activeBusinessId as Id<"businesses">} />;
}

interface OrdersContentProps {
  businessId: Id<"businesses">;
}

function OrdersContent({ businessId }: OrdersContentProps) {
  const navigate = useNavigate();
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
    navigate({ to: "/orders/$orderId", params: { orderId } });
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <h1 className="text-2xl font-bold font-heading mb-6">Orders</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Orders</CardTitle>
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
                      <StatusBadge status={order.status} type="order" />
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
  );
}
