import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useMutation } from "convex/react";
import { ArrowLeft, ExternalLink, MapPin, Phone, User, CreditCard, Truck, Package, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import SignInForm from "@/components/sign-in-form";
import BusinessSwitcher from "@/components/business-switcher";
import AppNav from "@/components/app-nav";
import UserMenu from "@/components/user-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders_/$orderId")({
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
        <OrderDetailPageContent />
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

function OrderDetailPageContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orderId } = Route.useParams();

  const [isProcessing, setIsProcessing] = useState(false);

  const orderQuery = useQuery(
    convexQuery(api.orders.get, { orderId: orderId as Id<"orders"> })
  );

  const order = orderQuery.data;

  const markPreparing = useMutation(api.orders.markPreparing);
  const markReady = useMutation(api.orders.markReady);
  const markDelivered = useMutation(api.orders.markDelivered);
  const cancelOrder = useMutation(api.orders.cancel);

  const handleMarkPreparing = async () => {
    setIsProcessing(true);
    try {
      await markPreparing({ orderId: orderId as Id<"orders"> });
      toast.success("Order marked as preparing");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkReady = async () => {
    setIsProcessing(true);
    try {
      await markReady({ orderId: orderId as Id<"orders"> });
      toast.success("Order marked as ready");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkDelivered = async () => {
    setIsProcessing(true);
    try {
      await markDelivered({ orderId: orderId as Id<"orders"> });
      toast.success("Order marked as delivered");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelOrder = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this order? This action cannot be undone."
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await cancelOrder({ orderId: orderId as Id<"orders"> });
      toast.success("Order cancelled");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel order");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (orderQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (order === null || order === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BusinessSwitcher />
              <AppNav />
            </div>
            <UserMenu />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/orders" })}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">Order not found</h3>
              <p className="text-sm text-muted-foreground">
                The order you're looking for doesn't exist or you don't have access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const showMarkPreparing = order.status === "confirmed" || order.status === "paid";
  const showMarkReady = order.status === "preparing";
  const showMarkDelivered = order.status === "ready";
  const showCancel = order.status === "draft" || order.status === "confirmed";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
            <AppNav />
          </div>
          <UserMenu />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/orders" })}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Orders
        </Button>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold">
                  Order #{order.orderNumber}
                </CardTitle>
                <StatusBadge status={order.status as OrderStatus} />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timestamps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDateTime(order.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{formatDateTime(order.updatedAt)}</span>
                </div>
                {order.cancelledAt && (
                  <div className="flex justify-between text-red-600">
                    <span>Cancelled</span>
                    <span>{formatDateTime(order.cancelledAt)}</span>
                  </div>
                )}
                {order.cancellationReason && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cancellation Reason</span>
                    <span className="text-red-600">{order.cancellationReason}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitPrice, order.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.totalPrice, order.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{formatCurrency(order.deliveryFee, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-bold">Grand Total</span>
                  <span className="font-bold">{formatCurrency(order.total, order.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                <CardTitle>Delivery</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{order.deliveryType}</span>
                </div>
                {order.deliveryType === "delivery" && order.deliveryAddress && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Address
                    </span>
                    <span className="text-right max-w-[60%]">{order.deliveryAddress}</span>
                  </div>
                )}
                {order.deliveryNotes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notes</span>
                    <span className="text-right max-w-[60%]">{order.deliveryNotes}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <CardTitle>Customer</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Phone
                  </span>
                  <span>{order.contactPhone}</span>
                </div>
                {order.contactName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span>{order.contactName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <CardTitle>Payment</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="capitalize">{order.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={cn(
                    "capitalize",
                    order.paymentStatus === "paid" && "text-green-600",
                    order.paymentStatus === "failed" && "text-red-600",
                    order.paymentStatus === "refunded" && "text-orange-600"
                  )}>
                    {order.paymentStatus}
                  </span>
                </div>
                {order.paymentMethod === "card" && order.paymentLinkUrl && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment Link</span>
                    <a
                      href={order.paymentLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      Open Link
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {(showMarkPreparing || showMarkReady || showMarkDelivered || showCancel) && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {showMarkPreparing && (
                    <Button onClick={handleMarkPreparing} disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Mark Preparing
                    </Button>
                  )}
                  {showMarkReady && (
                    <Button onClick={handleMarkReady} disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Mark Ready
                    </Button>
                  )}
                  {showMarkDelivered && (
                    <Button onClick={handleMarkDelivered} disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Mark Delivered
                    </Button>
                  )}
                  {showCancel && (
                    <Button variant="destructive" onClick={handleCancelOrder} disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Cancel Order
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
