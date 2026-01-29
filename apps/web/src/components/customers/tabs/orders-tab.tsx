import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import type { useNavigate } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface OrdersTabProps {
	customerId: Id<"customers">;
	formatCurrency: (amountInCents: number, currency?: "COP" | "BRL" | "MXN" | "USD") => string;
	formatDate: (timestamp: number) => string;
	navigate: ReturnType<typeof useNavigate>;
}

export function OrdersTab({ customerId, formatCurrency, formatDate, navigate }: OrdersTabProps) {
	const ordersQuery = useQuery(convexQuery(api.orders.queries.listByCustomer, { customerId }));

	const orders = ordersQuery.data?.orders ?? [];

	if (ordersQuery.isLoading) {
		return <div className="py-8 text-center text-muted-foreground">Loading orders...</div>;
	}

	if (orders.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<ShoppingBag className="mb-4 h-10 w-10 text-muted-foreground" />
					<h3 className="mb-2 font-semibold text-lg">No orders yet</h3>
					<p className="text-muted-foreground text-sm">This customer hasn't placed any orders</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardContent className="p-0">
				<table className="w-full">
					<thead>
						<tr className="border-b">
							<th className="p-4 text-left font-medium">Order #</th>
							<th className="p-4 text-left font-medium">Items</th>
							<th className="p-4 text-left font-medium">Status</th>
							<th className="p-4 text-right font-medium">Total</th>
							<th className="p-4 text-right font-medium">Date</th>
						</tr>
					</thead>
					<tbody>
						{orders.map((order) => (
							<tr
								key={order._id}
								onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: order._id } })}
								className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
							>
								<td className="p-4 font-medium">{order.orderNumber}</td>
								<td className="p-4 text-muted-foreground">{order.items.length} items</td>
								<td className="p-4">
									<Badge
										variant={
											order.status === "delivered"
												? "success"
												: order.status === "cancelled"
													? "destructive"
													: "secondary"
										}
									>
										{order.status}
									</Badge>
								</td>
								<td className="p-4 text-right">
									{formatCurrency(order.total, order.currency as "COP" | "BRL" | "MXN" | "USD")}
								</td>
								<td className="p-4 text-right text-muted-foreground">
									{formatDate(order.createdAt)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</CardContent>
		</Card>
	);
}
