import { api } from "@echo/backend/convex/_generated/api";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChevronRight, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { MetaIntegrationCard } from "./integration-cards/meta-integration-card";

export function ChatsIntegrationsSettings() {
	const businesses = useQuery(api.businesses.list);
	const activeBusiness = businesses?.[0];
	const whatsappStatus = useQuery(
		api.integrations.whatsapp.settings.getConnectionStatus,
		activeBusiness ? { businessId: activeBusiness._id } : "skip",
	);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MessageCircle className="h-5 w-5" />
						WhatsApp Business
					</CardTitle>
					<CardDescription>Connect your WhatsApp to receive customer messages</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between rounded-lg border p-4">
						<div className="flex items-center gap-3">
							<div
								className={cn(
									"rounded-full p-2",
									whatsappStatus?.connected
										? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
										: "bg-muted text-muted-foreground",
								)}
							>
								<MessageCircle className="h-5 w-5" />
							</div>
							<div>
								<p className="font-medium">
									{whatsappStatus?.connected ? "Connected" : "Not Connected"}
								</p>
								<p className="text-muted-foreground text-sm">
									{whatsappStatus?.connected
										? whatsappStatus.phoneNumber || "WhatsApp Business API"
										: "Connect to start receiving messages"}
								</p>
							</div>
						</div>
						<Link to="/settings/whatsapp">
							<Button variant={whatsappStatus?.connected ? "outline" : "default"}>
								{whatsappStatus?.connected ? "Configure" : "Connect"}
								<ChevronRight className="ml-2 h-4 w-4" />
							</Button>
						</Link>
					</div>
				</CardContent>
			</Card>

			<MetaIntegrationCard />
		</div>
	);
}
