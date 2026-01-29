import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Activity, DollarSign, MessageSquare, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UsageStatsProps {
	businessId: Id<"businesses">;
}

export function UsageStats({ businessId }: UsageStatsProps) {
	const stats = useQuery(api.ai.settings.getUsageStats, { businessId });

	if (stats === undefined) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>AI Usage Statistics</CardTitle>
					<CardDescription>Loading usage data...</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	if (stats === null) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>AI Usage Statistics</CardTitle>
					<CardDescription>Unable to load usage data</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>AI Usage Statistics</CardTitle>
				<CardDescription>Last 30 days</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<StatCard
						icon={<Zap className="h-4 w-4" />}
						label="Total Tokens"
						value={stats.totalTokens.toLocaleString()}
					/>
					<StatCard
						icon={<MessageSquare className="h-4 w-4" />}
						label="Conversations"
						value={stats.totalConversations.toString()}
					/>
					<StatCard
						icon={<Activity className="h-4 w-4" />}
						label="Avg Latency"
						value={`${stats.avgLatencyMs}ms`}
					/>
					<StatCard
						icon={<DollarSign className="h-4 w-4" />}
						label="Est. Cost"
						value={`$${stats.estimatedCostUsd.toFixed(2)}`}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

interface StatCardProps {
	icon: React.ReactNode;
	label: string;
	value: string;
}

function StatCard({ icon, label, value }: StatCardProps) {
	return (
		<div className="flex flex-col space-y-1">
			<div className="flex items-center space-x-2 text-muted-foreground">
				{icon}
				<span className="text-xs">{label}</span>
			</div>
			<span className="font-semibold text-lg">{value}</span>
		</div>
	);
}
