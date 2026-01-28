import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	ArrowLeft,
	CreditCard,
	ExternalLink,
	Loader2,
	MapPin,
	MessageSquare,
	Package,
	Phone,
	Store,
	Truck,
	User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/composed/status-badge";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/formatting";
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
		convexQuery(api.orders.queries.get, { orderId: orderId as Id<"orders"> }),
	);

	const order = orderQuery.data;

	const shopifyQuery = useQuery(
		convexQuery(api.integrations.shopify.queries.getConnectionStatus, {
			businessId: (order?.businessId ?? "placeholder") as Id<"businesses">,
		}),
	);

	const shopifyConnection = order?.businessId ? shopifyQuery.data : null;

	const markPreparing = useMutation(api.orders.status.markPreparing);
	const markReady = useMutation(api.orders.status.markReady);
	const markDelivered = useMutation(api.orders.status.markDelivered);
	const cancelOrder = useMutation(api.orders.status.cancel);

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

	if (orderQuery.isLoading) {
		return (
			<div className="container mx-auto max-w-4xl px-6 py-8">
				<div className="flex min-h-[400px] items-center justify-center">
					<div className="text-muted-foreground">Loading...</div>
				</div>
			</div>
		);
	}

	if (order === null || order === undefined) {
		return (
			<div className="container mx-auto max-w-4xl px-6 py-8">
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
						<h3 className="mb-2 font-semibold text-lg">Order not found</h3>
						<p className="text-muted-foreground text-sm">
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
		<div className="container mx-auto max-w-6xl px-6 py-8">
			<Button
				variant="ghost"
				size="sm"
				onClick={() => navigate({ to: "/orders" })}
				className="mb-4"
			>
				<ArrowLeft className="mr-2 h-4 w-4" />
				Back to Orders
			</Button>

			<div className="mb-6 flex items-center justify-between">
				<div className="flex items-center gap-4">
					<h1 className="font-bold font-heading text-2xl">Order #{order.orderNumber}</h1>
					<StatusBadge status={order.status} type="order" />
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<div className="space-y-6 lg:col-span-2">
					<Card>
						<CardHeader>
							<CardTitle>Order Items</CardTitle>
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
												{formatCurrency(
													item.unitPrice,
													order.currency as "COP" | "BRL" | "MXN" | "USD",
												)}
											</TableCell>
											<TableCell className="text-right">
												{formatCurrency(
													item.totalPrice,
													order.currency as "COP" | "BRL" | "MXN" | "USD",
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>

							<div className="mt-6 space-y-2 border-t pt-4">
								<div className="flex justify-between text-sm">
									<span className="text-muted-foreground">Subtotal</span>
									<span>
										{formatCurrency(
											order.subtotal,
											order.currency as "COP" | "BRL" | "MXN" | "USD",
										)}
									</span>
								</div>
								{order.deliveryFee !== undefined && order.deliveryFee > 0 && (
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Delivery Fee</span>
										<span>
											{formatCurrency(
												order.deliveryFee,
												order.currency as "COP" | "BRL" | "MXN" | "USD",
											)}
										</span>
									</div>
								)}
								<div className="flex justify-between border-t pt-2 font-bold text-base">
									<span>Total</span>
									<span>
										{formatCurrency(order.total, order.currency as "COP" | "BRL" | "MXN" | "USD")}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{order.conversationId && (
						<Card>
							<CardContent className="py-4">
								<Button
									variant="ghost"
									onClick={() =>
										navigate({
											to: "/conversations/$conversationId",
											params: { conversationId: order.conversationId },
										})
									}
									className="-m-4 flex h-auto w-full items-center justify-start gap-3 rounded-lg p-4"
								>
									<div className="rounded-full bg-muted p-2">
										<MessageSquare className="h-4 w-4 text-muted-foreground" />
									</div>
									<div className="text-left">
										<p className="font-medium text-sm">Related Conversation</p>
										<p className="text-muted-foreground text-xs">
											View the chat that created this order
										</p>
									</div>
								</Button>
							</CardContent>
						</Card>
					)}

					{(showMarkPreparing || showMarkReady || showMarkDelivered || showCancel) && (
						<Card>
							<CardContent className="py-4">
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
											<Button
												variant="destructive"
												disabled={isProcessing}
												onClick={() => setShowCancelDialog(true)}
											>
												{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
												Cancel Order
											</Button>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Cancel Order</AlertDialogTitle>
													<AlertDialogDescription>
														Are you sure you want to cancel this order? This action cannot be
														undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Keep Order</AlertDialogCancel>
													<AlertDialogAction
														onClick={handleCancelOrder}
														className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
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

				<div className="space-y-6">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<User className="h-4 w-4" />
								<CardTitle>Customer</CardTitle>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-3 text-sm">
								<div className="flex items-center gap-2">
									<Phone className="h-4 w-4 text-muted-foreground" />
									<span>{order.contactPhone}</span>
								</div>
								{order.contactName && (
									<div className="flex items-center gap-2">
										<User className="h-4 w-4 text-muted-foreground" />
										<span>{order.contactName}</span>
									</div>
								)}
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
							<div className="space-y-3 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Type</span>
									<span className="font-medium capitalize">{order.deliveryType}</span>
								</div>
								{order.deliveryType === "delivery" && order.deliveryAddress && (
									<div>
										<div className="mb-1 flex items-center gap-1 text-muted-foreground">
											<MapPin className="h-3 w-3" />
											<span>Address</span>
										</div>
										<p className="text-sm">{order.deliveryAddress}</p>
									</div>
								)}
								{order.deliveryNotes && (
									<div>
										<span className="text-muted-foreground">Notes</span>
										<p className="mt-1 text-sm">{order.deliveryNotes}</p>
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
							<div className="space-y-3 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Method</span>
									<span className="font-medium capitalize">{order.paymentMethod}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Status</span>
									<span
										className={cn(
											"font-medium capitalize",
											order.paymentStatus === "paid" && "text-green-600",
											order.paymentStatus === "failed" && "text-red-600",
											order.paymentStatus === "refunded" && "text-orange-600",
										)}
									>
										{order.paymentStatus}
									</span>
								</div>
								{order.paymentProvider && (
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground">Provider</span>
										<span
											className={cn(
												"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs",
												order.paymentProvider === "shopify" &&
													"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
												order.paymentProvider === "stripe" &&
													"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
												order.paymentProvider === "cash" &&
													"bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
											)}
										>
											{order.paymentProvider === "shopify" && <Store className="h-3 w-3" />}
											{order.paymentProvider === "stripe" && <CreditCard className="h-3 w-3" />}
											Paid via{" "}
											{order.paymentProvider === "shopify"
												? "Shopify"
												: order.paymentProvider === "stripe"
													? "Stripe"
													: "Cash"}
										</span>
									</div>
								)}
								{order.shopifyOrderNumber && (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Shopify Order</span>
										<span className="font-medium">{order.shopifyOrderNumber}</span>
									</div>
								)}
								{order.shopifyOrderId && shopifyConnection?.connected && shopifyConnection.shop && (
									<a
										href={`https://${shopifyConnection.shop}/admin/orders/${order.shopifyOrderId}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-1 text-primary text-sm hover:underline"
									>
										View in Shopify
										<ExternalLink className="h-3 w-3" />
									</a>
								)}
								{order.paymentMethod === "card" &&
									order.paymentLinkUrl &&
									!order.shopifyOrderId && (
										<a
											href={order.paymentLinkUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1 text-primary text-sm hover:underline"
										>
											Open Payment Link
											<ExternalLink className="h-3 w-3" />
										</a>
									)}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Timeline</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">Created</span>
									<span>{formatDateTime(order.createdAt)}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Updated</span>
									<span>{formatDateTime(order.updatedAt)}</span>
								</div>
								{order.cancelledAt && (
									<div className="flex justify-between text-destructive">
										<span>Cancelled</span>
										<span>{formatDateTime(order.cancelledAt)}</span>
									</div>
								)}
								{order.cancellationReason && (
									<div className="border-t pt-2">
										<span className="text-muted-foreground">Reason</span>
										<p className="mt-1 text-destructive">{order.cancellationReason}</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
