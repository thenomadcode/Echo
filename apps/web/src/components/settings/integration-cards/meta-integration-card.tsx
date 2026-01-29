import { api } from "@echo/backend/convex/_generated/api";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChevronRight, Facebook } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetaIntegrationCard() {
	const businesses = useQuery(api.businesses.list);
	const activeBusiness = businesses?.[0];
	const metaStatus = useQuery(
		api.integrations.meta.queries.getConnectionStatus,
		activeBusiness ? { businessId: activeBusiness._id } : "skip",
	);

	const isConnected = metaStatus?.connected === true;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Facebook className="h-5 w-5" />
					Meta (Messenger & Instagram)
				</CardTitle>
				<CardDescription>Connect Facebook Messenger and Instagram DMs</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-between rounded-lg border p-4">
					<div className="flex items-center gap-3">
						<div
							className={cn(
								"rounded-full p-2",
								isConnected
									? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
									: "bg-muted text-muted-foreground",
							)}
						>
							<Facebook className="h-5 w-5" />
						</div>
						<div>
							<p className="font-medium">{isConnected ? "Connected" : "Not Connected"}</p>
							<p className="text-muted-foreground text-sm">
								{isConnected
									? `${metaStatus.pageName}${metaStatus.instagramUsername ? ` • @${metaStatus.instagramUsername}` : ""}`
									: "Connect to receive Messenger and Instagram messages"}
							</p>
						</div>
					</div>
					<Link to="/settings/integrations/meta" search={{ connected: false, error: undefined }}>
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
