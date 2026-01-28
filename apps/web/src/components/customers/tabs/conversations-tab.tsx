import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import type { useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface ConversationsTabProps {
	customerId: Id<"customers">;
	formatDate: (timestamp: number) => string;
	navigate: ReturnType<typeof useNavigate>;
}

export function ConversationsTab({ customerId, formatDate, navigate }: ConversationsTabProps) {
	const conversationsQuery = useQuery(
		convexQuery(api.conversations.listByCustomer, { customerId }),
	);

	const summariesQuery = useQuery(
		convexQuery(api.conversationSummaries.listByCustomer, { customerId }),
	);

	const conversations = conversationsQuery.data ?? [];
	const summaries = summariesQuery.data ?? [];

	const summaryMap = new Map(summaries.map((s) => [s.conversationId, s]));

	if (conversationsQuery.isLoading) {
		return <div className="py-8 text-center text-muted-foreground">Loading conversations...</div>;
	}

	if (conversations.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<MessageCircle className="mb-4 h-10 w-10 text-muted-foreground" />
					<h3 className="mb-2 font-semibold text-lg">No conversations yet</h3>
					<p className="text-muted-foreground text-sm">
						Conversations with this customer will appear here
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			{conversations.map((conv) => {
				const summary = summaryMap.get(conv._id);
				return (
					<Card
						key={conv._id}
						className="cursor-pointer transition-colors hover:bg-muted/50"
						onClick={() =>
							navigate({
								to: "/conversations/$conversationId",
								params: { conversationId: conv._id },
							})
						}
					>
						<CardContent className="py-4">
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="mb-1 flex items-center gap-2">
										<Badge
											variant={
												conv.status === "closed"
													? "secondary"
													: conv.status === "escalated"
														? "warning"
														: "default"
											}
										>
											{conv.status}
										</Badge>
										{summary?.sentiment && (
											<Badge
												variant={
													summary.sentiment === "positive"
														? "success"
														: summary.sentiment === "negative"
															? "destructive"
															: "secondary"
												}
											>
												{summary.sentiment}
											</Badge>
										)}
									</div>
									{summary ? (
										<p className="line-clamp-2 text-muted-foreground text-sm">{summary.summary}</p>
									) : (
										<p className="text-muted-foreground text-sm italic">No summary available</p>
									)}
								</div>
								<div className="whitespace-nowrap text-right text-muted-foreground text-sm">
									{formatDate(conv.createdAt)}
								</div>
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
