import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, Check, Clock, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type SyncStatusType = "success" | "partial" | "failed" | null;

interface SyncStatusProps {
	lastSyncAt: number | null;
	status: SyncStatusType;
	lastSyncError?: string | null;
}

export function SyncStatus({ lastSyncAt, status, lastSyncError }: SyncStatusProps) {
	if (lastSyncAt === null) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<Clock className="h-4 w-4" />
				<span>Never synced</span>
			</div>
		);
	}

	const absoluteTime = format(new Date(lastSyncAt), "PPpp");
	const relativeTime = formatDistanceToNow(new Date(lastSyncAt), {
		addSuffix: true,
	});

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-3">
				<Tooltip>
					<TooltipTrigger className="cursor-help text-muted-foreground text-sm">
						{relativeTime}
					</TooltipTrigger>
					<TooltipContent>
						<p>{absoluteTime}</p>
					</TooltipContent>
				</Tooltip>

				{status && <SyncStatusIcon status={status} />}
			</div>
			{lastSyncError && (status === "failed" || status === "partial") && (
				<div className="text-destructive text-xs">{lastSyncError}</div>
			)}
		</div>
	);
}

function SyncStatusIcon({
	status,
}: {
	status: "success" | "partial" | "failed";
}) {
	switch (status) {
		case "success":
			return (
				<Badge variant="success" className="flex items-center gap-1">
					<Check className="h-3 w-3" />
					Success
				</Badge>
			);
		case "partial":
			return (
				<Badge variant="warning" className="flex items-center gap-1">
					<AlertTriangle className="h-3 w-3" />
					Partial
				</Badge>
			);
		case "failed":
			return (
				<Badge variant="destructive" className="flex items-center gap-1">
					<X className="h-3 w-3" />
					Failed
				</Badge>
			);
	}
}
