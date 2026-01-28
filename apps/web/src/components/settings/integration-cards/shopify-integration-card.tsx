import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ShopifyIntegrationCard() {
	const businesses = useQuery(api.businesses.list);
	const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("echo:activeBusinessId");
			if (stored) {
				setActiveBusinessId(stored);
			}
		}
	}, []);

	useEffect(() => {
		if (businesses && businesses.length > 0 && !activeBusinessId) {
			setActiveBusinessId(businesses[0]._id);
		}
	}, [businesses, activeBusinessId]);

	const shopifyStatus = useQuery(
		api.integrations.shopify.queries.getConnectionStatus,
		activeBusinessId ? { businessId: activeBusinessId as Id<"businesses"> } : "skip",
	);

	const isConnected = shopifyStatus?.connected === true;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ShoppingBag className="h-5 w-5" />
					Shopify
				</CardTitle>
				<CardDescription>Sync your product catalog from Shopify</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-between rounded-lg border p-4">
					<div className="flex items-center gap-3">
						<div
							className={cn(
								"rounded-full p-2",
								isConnected
									? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
									: "bg-muted text-muted-foreground",
							)}
						>
							<ShoppingBag className="h-5 w-5" />
						</div>
						<div>
							<p className="font-medium">{isConnected ? "Connected" : "Not Connected"}</p>
							<p className="text-muted-foreground text-sm">
								{isConnected
									? shopifyStatus.shop
									: "Import products directly from your Shopify store"}
							</p>
						</div>
					</div>
					<Link to="/settings/integrations/shopify" search={{ connected: false, error: undefined }}>
						<Button variant={isConnected ? "outline" : "default"}>
							{isConnected ? "Configure" : "Connect"}
							<ChevronRight className="ml-2 h-4 w-4" />
						</Button>
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}
