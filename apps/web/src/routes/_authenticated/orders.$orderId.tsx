import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowLeft, ExternalLink, MapPin, Phone, User, CreditCard, Truck, Package, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/composed/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orderId } = Route.useParams();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

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
    setIsProcessing(true);
    try {
      await cancelOrder({ orderId: orderId as Id<"orders"> });
      toast.success("Order cancelled");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel order");
    } finally {
      setIsProcessing(false);
      setShowCancelDialog(false);
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
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (order === null || order === undefined) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-4xl">
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
    );
  }

  const showMarkPreparing = order.status === "confirmed" || order.status === "paid";
  const showMarkReady = order.status === "preparing";
  const showMarkDelivered = order.status === "ready";
  const showCancel = order.status === "draft" || order.status === "confirmed";

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
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
              <StatusBadge status={order.status} type="order" />
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
                  <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                    <Button variant="destructive" disabled={isProcessing} onClick={() => setShowCancelDialog(true)}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Cancel Order
                    </Button>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel this order? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Order</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Cancel Order
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
