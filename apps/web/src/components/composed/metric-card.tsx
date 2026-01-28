import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
	title: string;
	value: string | number;
	subtitle?: string;
	icon: LucideIcon;
	link?: string;
	variant?: "default" | "warning";
}

export function MetricCard({
	title,
	value,
	subtitle,
	icon: Icon,
	link,
	variant = "default",
}: MetricCardProps) {
	const content = (
		<Card
			className={cn(
				"transition-colors hover:bg-accent/50",
				variant === "warning" && "border-warning/50 bg-warning/5",
				link && "cursor-pointer",
			)}
		>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="font-medium text-muted-foreground text-sm">{title}</CardTitle>
				<Icon
					className={cn(
						"h-5 w-5",
						variant === "warning" ? "text-warning" : "text-muted-foreground",
					)}
				/>
			</CardHeader>
			<CardContent>
				<div className="font-bold font-heading text-3xl">{value}</div>
				{subtitle && (
					<p
						className={cn(
							"mt-1 text-sm",
							variant === "warning" ? "font-medium text-warning" : "text-muted-foreground",
						)}
					>
						{subtitle}
					</p>
				)}
			</CardContent>
		</Card>
	);

	if (link) {
		return (
			<Link to={link} className="block">
				{content}
			</Link>
		);
	}

	return content;
}
