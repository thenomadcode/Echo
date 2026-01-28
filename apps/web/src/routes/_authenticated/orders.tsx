import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Search, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/composed/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatting";

export const Route = createFileRoute("/_authenticated/orders")({
	component: OrdersPage,
});

type OrderStatus =
	| "draft"
	| "confirmed"
	| "paid"
	| "preparing"
	| "ready"
	| "delivered"
	| "cancelled";

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

const ITEMS_PER_PAGE = 10;

function OrdersContent({ businessId }: OrdersContentProps) {
	const navigate = useNavigate();
	const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);

	const ordersQuery = useQuery(
		convexQuery(api.orders.listByBusiness, {
			businessId,
			status: statusFilter === "all" ? undefined : statusFilter,
			limit: 50,
		}),
	);

	const allOrders = ordersQuery.data?.orders ?? [];

	const filteredOrders = useMemo(() => {
		if (!searchQuery.trim()) return allOrders;
		const query = searchQuery.toLowerCase();
		return allOrders.filter((order) => {
			const orderNumberMatch = order.orderNumber?.toLowerCase().includes(query);
			const phoneMatch = order.contactPhone?.toLowerCase().includes(query);
			return orderNumberMatch || phoneMatch;
		});
	}, [allOrders, searchQuery]);

	const totalOrders = filteredOrders.length;
	const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);
	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalOrders);
	const orders = filteredOrders.slice(startIndex, endIndex);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchQuery, statusFilter]);

	const formatSmartDate = (timestamp: number) => {
		const date = new Date(timestamp);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		const isToday = date.toDateString() === today.toDateString();
		const isYesterday = date.toDateString() === yesterday.toDateString();

		if (isToday) return "Today";
		if (isYesterday) return "Yesterday";
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	};

	const handleRowClick = (orderId: Id<"orders">) => {
		navigate({ to: "/orders/$orderId", params: { orderId } });
	};

	return (
		<div className="container mx-auto max-w-7xl px-6 py-8">
			<h1 className="mb-6 font-bold font-heading text-2xl">Orders</h1>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>All Orders</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					<div className="mb-6">
						<div className="flex flex-col gap-4 md:flex-row md:items-end">
							<div className="flex-1 space-y-2 md:max-w-xs">
								<Label htmlFor="search">Search</Label>
								<div className="relative">
									<Search className="-translate-y-1/2 absolute top-1/2 left-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										id="search"
										type="text"
										placeholder="Search by order # or phone..."
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										className="h-9 pl-8 text-sm"
									/>
								</div>
							</div>
							<div className="space-y-2 md:w-48">
								<Label htmlFor="status">Status</Label>
								<Select
									value={statusFilter}
									onValueChange={(value) => value && setStatusFilter(value as OrderStatus | "all")}
								>
									<SelectTrigger className="h-9 w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										<SelectItem value="draft">Draft</SelectItem>
										<SelectItem value="confirmed">Confirmed</SelectItem>
										<SelectItem value="paid">Paid</SelectItem>
										<SelectItem value="preparing">Preparing</SelectItem>
										<SelectItem value="ready">Ready</SelectItem>
										<SelectItem value="delivered">Delivered</SelectItem>
										<SelectItem value="cancelled">Cancelled</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>

					{ordersQuery.isLoading ? (
						<div className="flex items-center justify-center py-12">
							<div className="text-muted-foreground">Loading orders...</div>
						</div>
					) : filteredOrders.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<div className="mb-4 rounded-full bg-muted p-6">
								<ShoppingBag className="h-10 w-10 text-muted-foreground" />
							</div>
							<h3 className="mb-2 font-semibold text-lg">No orders yet</h3>
							<p className="max-w-[320px] text-muted-foreground text-sm">
								Orders will appear here when customers place orders through WhatsApp
							</p>
						</div>
					) : (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Order #</TableHead>
										<TableHead>Customer</TableHead>
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
											className="cursor-pointer transition-colors hover:bg-muted/50"
										>
											<TableCell className="font-medium">{order.orderNumber}</TableCell>
											<TableCell className="text-muted-foreground">
												{order.contactPhone || "-"}
											</TableCell>
											<TableCell>
												<StatusBadge status={order.status} type="order" />
											</TableCell>
											<TableCell className="text-center">{order.items.length}</TableCell>
											<TableCell className="text-right">
												{formatCurrency(
													order.total,
													order.currency as "COP" | "BRL" | "MXN" | "USD",
												)}
											</TableCell>
											<TableCell className="text-right text-muted-foreground">
												{formatSmartDate(order.createdAt)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>

							{totalPages > 1 && (
								<div className="mt-4 flex items-center justify-between border-t pt-4">
									<p className="text-muted-foreground text-sm">
										Showing {startIndex + 1}-{endIndex} of {totalOrders} orders
									</p>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
											disabled={currentPage === 1}
										>
											<ChevronLeft className="mr-1 h-4 w-4" />
											Previous
										</Button>
										<span className="px-2 text-muted-foreground text-sm">
											Page {currentPage} of {totalPages}
										</span>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
											disabled={currentPage === totalPages}
										>
											Next
											<ChevronRight className="ml-1 h-4 w-4" />
										</Button>
									</div>
								</div>
							)}
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
