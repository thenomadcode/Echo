import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import {
	AlertTriangle,
	ChevronLeft,
	ChevronRight,
	Loader2,
	MapPin,
	StickyNote,
	User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency as formatCurrencyUtil } from "@/lib/formatting";

interface CustomerContextPanelProps {
	customerId: Id<"customers">;
	isCollapsed: boolean;
	onToggle: () => void;
}

export function CustomerContextPanel({
	customerId,
	isCollapsed,
	onToggle,
}: CustomerContextPanelProps) {
	const contextQuery = useQuery(convexQuery(api.customers.getContext, { customerId }));

	const context = contextQuery.data;
	const isLoading = contextQuery.isLoading;

	if (isLoading) {
		return (
			<div
				className={`border-l bg-muted/30 transition-all duration-300 ${isCollapsed ? "w-10" : "w-80"}`}
			>
				<Button variant="ghost" size="icon" onClick={onToggle} className="h-10 w-10 border-b">
					{isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
				</Button>
				{!isCollapsed && (
					<div className="flex items-center justify-center p-4">
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				)}
			</div>
		);
	}

	if (!context) {
		return null;
	}

	const defaultAddress = context.addresses.find((a) => a.isDefault);
	const hasAllergies = context.memory.allergies.length > 0;

	return (
		<div
			className={`flex flex-col border-l bg-muted/30 transition-all duration-300 ${isCollapsed ? "w-10" : "w-80"}`}
		>
			<Button
				variant="ghost"
				size="icon"
				onClick={onToggle}
				className="h-10 w-10 flex-shrink-0 border-b"
				aria-label={isCollapsed ? "Expand customer panel" : "Collapse customer panel"}
			>
				{isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
			</Button>

			{isCollapsed && (
				<div className="flex flex-1 flex-col items-center gap-2 pt-4">
					<User className="h-5 w-5 text-muted-foreground" />
					{hasAllergies && (
						<span title="Has allergies">
							<AlertTriangle className="h-4 w-4 text-destructive" />
						</span>
					)}
				</div>
			)}

			{!isCollapsed && (
				<div className="flex-1 space-y-4 overflow-y-auto p-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<h3 className="truncate font-semibold">
								{context.profile.name || context.profile.phone}
							</h3>
						</div>
						{context.profile.name && (
							<p className="text-muted-foreground text-sm">{context.profile.phone}</p>
						)}
					</div>

					<div className="flex gap-4 text-sm">
						<div>
							<span className="text-muted-foreground">Orders:</span>{" "}
							<span className="font-medium">{context.profile.totalOrders}</span>
						</div>
						<div>
							<span className="text-muted-foreground">Spent:</span>{" "}
							<span className="font-medium">
								{formatCurrencyUtil(context.profile.totalSpent, "USD")}
							</span>
						</div>
					</div>

					{defaultAddress && (
						<div className="space-y-1">
							<div className="flex items-center gap-1.5 font-medium text-sm">
								<MapPin className="h-3.5 w-3.5 text-muted-foreground" />
								Default Address
							</div>
							<p className="pl-5 text-muted-foreground text-sm">
								{defaultAddress.label}: {defaultAddress.address}
							</p>
						</div>
					)}

					{hasAllergies && (
						<div className="space-y-1.5">
							<div className="flex items-center gap-1.5 font-medium text-destructive text-sm">
								<AlertTriangle className="h-3.5 w-3.5" />
								Allergies
							</div>
							<div className="flex flex-wrap gap-1 pl-5">
								{context.memory.allergies.map((allergy, i) => (
									<Badge key={i} variant="destructive" className="text-xs">
										{allergy}
									</Badge>
								))}
							</div>
						</div>
					)}

					{context.memory.restrictions.length > 0 && (
						<div className="space-y-1.5">
							<p className="font-medium text-sm">Restrictions</p>
							<div className="flex flex-wrap gap-1">
								{context.memory.restrictions.map((restriction, i) => (
									<Badge
										key={i}
										variant="secondary"
										className="bg-orange-100 text-orange-800 text-xs dark:bg-orange-900/30 dark:text-orange-400"
									>
										{restriction}
									</Badge>
								))}
							</div>
						</div>
					)}

					{context.memory.preferences.length > 0 && (
						<div className="space-y-1.5">
							<p className="font-medium text-sm">Preferences</p>
							<div className="flex flex-wrap gap-1">
								{context.memory.preferences.slice(0, 5).map((pref, i) => (
									<Badge key={i} variant="secondary" className="text-xs">
										{pref}
									</Badge>
								))}
								{context.memory.preferences.length > 5 && (
									<Badge variant="outline" className="text-xs">
										+{context.memory.preferences.length - 5} more
									</Badge>
								)}
							</div>
						</div>
					)}

					{context.businessNotes && (
						<div className="space-y-1.5">
							<div className="flex items-center gap-1.5 font-medium text-sm">
								<StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
								Notes
							</div>
							<p className="line-clamp-3 whitespace-pre-wrap pl-5 text-muted-foreground text-sm">
								{context.businessNotes}
							</p>
						</div>
					)}

					<div className="pt-2">
						<Link
							to="/customers/$customerId"
							params={{ customerId }}
							className="text-primary text-sm hover:underline"
						>
							View Full Profile →
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
