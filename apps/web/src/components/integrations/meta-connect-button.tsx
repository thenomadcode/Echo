import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { Facebook, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface MetaConnectButtonProps {
	businessId: Id<"businesses">;
	className?: string;
}

export function MetaConnectButton({ businessId, className }: MetaConnectButtonProps) {
	const [isConnecting, setIsConnecting] = useState(false);
	const startOAuth = useAction(api.integrations.meta.actions.startOAuth);

	const handleConnect = async () => {
		if (!businessId) {
			toast.error("No business selected");
			return;
		}

		setIsConnecting(true);

		try {
			const result = await startOAuth({
				businessId: businessId,
			});

			window.location.href = result.authUrl;
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to start connection";
			toast.error(message);
			setIsConnecting(false);
		}
	};

	return (
		<Button
			onClick={handleConnect}
			disabled={isConnecting}
			className={`bg-[#1877F2] hover:bg-[#1877F2]/90 ${className ?? ""}`}
		>
			{isConnecting ? (
				<>
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					Connecting...
				</>
			) : (
				<>
					<Facebook className="mr-2 h-4 w-4" />
					Connect with Facebook
				</>
			)}
		</Button>
	);
}
