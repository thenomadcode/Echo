import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

interface MetaDisconnectDialogProps {
	businessId: Id<"businesses">;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDisconnected?: () => void;
}

export function MetaDisconnectDialog({
	businessId,
	open,
	onOpenChange,
	onDisconnected,
}: MetaDisconnectDialogProps) {
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const disconnect = useAction(api.integrations.meta.actions.disconnect);

	const handleDisconnect = async () => {
		if (!businessId) {
			toast.error("No active business selected");
			return;
		}

		setIsDisconnecting(true);

		try {
			const result = await disconnect({
				businessId: businessId,
			});

			if (result.success) {
				toast.success("Meta disconnected successfully");
				onOpenChange(false);
				onDisconnected?.();
			} else {
				toast.error(result.error ?? "Failed to disconnect");
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Disconnect failed";
			toast.error(message);
		} finally {
			setIsDisconnecting(false);
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Disconnect Meta?</AlertDialogTitle>
					<AlertDialogDescription>
						You will no longer receive messages from Messenger or Instagram DMs. Existing
						conversations will be preserved but new messages won't be received. You can reconnect
						anytime.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDisconnect}
						disabled={isDisconnecting}
						variant="destructive"
					>
						{isDisconnecting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Disconnecting...
							</>
						) : (
							"Disconnect"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
