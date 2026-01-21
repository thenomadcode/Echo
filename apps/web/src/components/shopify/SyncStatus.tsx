import { Check, AlertTriangle, X, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SyncStatusType = "success" | "partial" | "failed" | null;

interface SyncStatusProps {
  lastSyncAt: number | null;
  status: SyncStatusType;
}

export function SyncStatus({ lastSyncAt, status }: SyncStatusProps) {
  if (lastSyncAt === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
    <div className="flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger className="text-sm text-muted-foreground cursor-help">
          {relativeTime}
        </TooltipTrigger>
        <TooltipContent>
          <p>{absoluteTime}</p>
        </TooltipContent>
      </Tooltip>

      {status && <SyncStatusIcon status={status} />}
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
