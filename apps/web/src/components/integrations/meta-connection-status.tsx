import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { Check, Facebook, Instagram, Loader2, RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConnectionStatus {
	connected: boolean;
	pageId: string | null;
	pageName: string | null;
	instagramAccountId: string | null;
	instagramUsername: string | null;
	permissions: string[];
	webhooksSubscribed: boolean;
	verified: boolean;
	lastMessageAt: number | null;
	tokenExpiresAt: number | null;
	createdAt: number | null;
}

interface MetaConnectionStatusProps {
	connectionStatus: ConnectionStatus;
	businessId: Id<"businesses">;
	onDisconnect: () => void;
	onTestConnection?: () => Promise<{ success: boolean; error?: string }>;
}

export function MetaConnectionStatus({
	connectionStatus,
	businessId,
	onDisconnect,
	onTestConnection,
}: MetaConnectionStatusProps) {
	const [isTesting, setIsTesting] = useState(false);

	const handleTestConnection = async () => {
		if (!businessId) {
			toast.error("No business selected");
			return;
		}

		if (!onTestConnection) {
			toast.info("Test connection will be available soon");
			return;
		}

		setIsTesting(true);

		try {
			const result = await onTestConnection();

			if (result.success) {
				toast.success("Connection is working!");
			} else {
				toast.error(result.error ?? "Connection test failed");
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Test failed";
			toast.error(message);
		} finally {
			setIsTesting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Connection Status</CardTitle>
					<Badge variant="success" className="flex items-center gap-1">
						<Check className="h-3 w-3" />
						Connected
					</Badge>
				</div>
				<CardDescription>
					Your Meta accounts are connected and ready to receive messages
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Facebook className="h-4 w-4 text-[#1877F2]" />
						<span className="text-muted-foreground text-sm">Facebook Page</span>
					</div>
					<span className="font-medium text-sm">{connectionStatus.pageName}</span>
				</div>

				{connectionStatus.instagramUsername && (
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Instagram className="h-4 w-4 text-[#E4405F]" />
							<span className="text-muted-foreground text-sm">Instagram</span>
						</div>
						<span className="font-medium text-sm">@{connectionStatus.instagramUsername}</span>
					</div>
				)}

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm">Webhooks</span>
					<Badge variant={connectionStatus.webhooksSubscribed ? "success" : "secondary"}>
						{connectionStatus.webhooksSubscribed ? "Active" : "Inactive"}
					</Badge>
				</div>

				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm">Last Message</span>
					<span className="font-medium text-sm">
						{connectionStatus.lastMessageAt
							? new Date(connectionStatus.lastMessageAt).toLocaleDateString()
							: "No messages yet"}
					</span>
				</div>

				<div className="flex gap-2 border-t pt-4">
					<Button
						variant="outline"
						size="sm"
						onClick={handleTestConnection}
						disabled={isTesting}
						className="flex-1"
					>
						{isTesting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Testing...
							</>
						) : (
							<>
								<RefreshCw className="mr-2 h-4 w-4" />
								Test Connection
							</>
						)}
					</Button>
					<Button variant="destructive" size="sm" onClick={onDisconnect} className="flex-1">
						<Unlink className="mr-2 h-4 w-4" />
						Disconnect
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
