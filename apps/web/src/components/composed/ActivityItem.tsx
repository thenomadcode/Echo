import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, MessageSquare, ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";

interface ActivityItemProps {
  type: "conversation" | "order";
  description: string;
  timestamp: number;
  link: string;
  isEscalation?: boolean;
}

export function ActivityItem({
  type,
  description,
  timestamp,
  link,
  isEscalation,
}: ActivityItemProps) {
  const Icon =
    isEscalation ? AlertTriangle : type === "conversation" ? MessageSquare : ShoppingCart;

  return (
    <Link
      to={link}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-accent/50",
        isEscalation && "bg-warning/10 hover:bg-warning/20"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full",
          isEscalation
            ? "bg-warning/20 text-warning"
            : type === "conversation"
              ? "bg-primary/10 text-primary"
              : "bg-secondary text-secondary-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{description}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </p>
      </div>
    </Link>
  );
}
