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
	const Icon = isEscalation
		? AlertTriangle
		: type === "conversation"
			? MessageSquare
			: ShoppingCart;

	return (
		<Link
			to={link}
			className={cn(
				"flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50",
				isEscalation && "bg-warning/10 hover:bg-warning/20",
			)}
		>
			<div
				className={cn(
					"flex h-9 w-9 items-center justify-center rounded-full",
					isEscalation
						? "bg-warning/20 text-warning"
						: type === "conversation"
							? "bg-primary/10 text-primary"
							: "bg-secondary text-secondary-foreground",
				)}
			>
				<Icon className="h-4 w-4" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">{description}</p>
				<p className="text-muted-foreground text-xs">
					{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
				</p>
			</div>
		</Link>
	);
}
