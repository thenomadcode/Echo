import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, MessageCircle, MessageSquare, Search, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/composed/StatusBadge";
import { MessageBubble } from "@/components/conversation/MessageBubble";
import { MessageInput } from "@/components/conversation/MessageInput";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/conversations")({
	component: ConversationsPage,
	validateSearch: (search: Record<string, unknown>): { conversationId?: string } => ({
		conversationId: typeof search.conversationId === "string" ? search.conversationId : undefined,
	}),
});

type ConversationStatus = "active" | "escalated" | "closed";

function ConversationsPage() {
	const businesses = useConvexQuery(api.businesses.list, {});

	const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

	useEffect(() => {
		if (businesses === undefined) return;

		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("echo:activeBusinessId");
			if (stored && businesses.find((b) => b._id === stored)) {
				setActiveBusinessId(stored);
			} else {
				setActiveBusinessId(businesses[0]?._id || null);
			}
		}
	}, [businesses]);

	if (businesses === undefined || !activeBusinessId) {
		return null;
	}

	return <ConversationsContent businessId={activeBusinessId as Id<"businesses">} />;
}

interface ConversationsContentProps {
	businessId: Id<"businesses">;
}

function ConversationsContent({ businessId }: ConversationsContentProps) {
	const navigate = useNavigate();
	const { conversationId: selectedConversationId } = Route.useSearch();
	const [statusFilter, setStatusFilter] = useState<ConversationStatus | "all">("all");
	const [searchQuery, setSearchQuery] = useState("");

	const conversationsQuery = useQuery(
		convexQuery(api.conversations.list, {
			businessId,
			status: statusFilter === "all" ? undefined : statusFilter,
			search: searchQuery || undefined,
			limit: 50,
		}),
	);

	const whatsappStatus = useQuery(
		convexQuery(api.integrations.whatsapp.settings.getConnectionStatus, { businessId }),
	);

	const conversations = conversationsQuery.data?.conversations ?? [];

	const truncateMessage = (message: string | null, maxLength = 50) => {
		if (!message) return "-";
		if (message.length <= maxLength) return message;
		return `${message.slice(0, maxLength)}...`;
	};

	const formatTime = (timestamp: number) => {
		const now = new Date();
		const date = new Date(timestamp);
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return "Yesterday";
		return formatDistanceToNow(date, { addSuffix: true });
	};

	const getCustomerInitials = (customerId: string) => {
		const isPhoneNumber = /^\+?\d+$/.test(customerId.replace(/\s/g, ""));
		if (isPhoneNumber) {
			return customerId.replace(/\D/g, "").charAt(0) || "?";
		}
		return customerId.charAt(0).toUpperCase();
	};

	const getStatusBorderColor = (status: string | null | undefined) => {
		switch (status) {
			case "escalated":
				return "border-l-yellow-500";
			case "closed":
				return "border-l-muted-foreground/50";
			default:
				return "border-l-primary";
		}
	};

	const handleConversationClick = useCallback(
		(id: string) => {
			if (typeof window !== "undefined" && window.innerWidth >= 1024) {
				navigate({ to: "/conversations", search: { conversationId: id } });
			} else {
				navigate({ to: "/conversations/$conversationId", params: { conversationId: id } });
			}
		},
		[navigate],
	);

	return (
		<div className="container mx-auto max-w-7xl px-6 py-8">
			<h1 className="mb-6 font-bold font-heading text-2xl">Conversations</h1>

			<div className="flex flex-col lg:flex-row lg:gap-6">
				<div className="w-full lg:w-[400px] lg:flex-shrink-0">
					<Card className="lg:flex lg:h-[calc(100vh-220px)] lg:flex-col">
						<CardHeader className="flex-shrink-0">
							<CardTitle>All Conversations</CardTitle>
						</CardHeader>
						<CardContent className="flex-1 p-0 lg:flex lg:flex-col lg:overflow-hidden">
							<div className="sticky top-0 z-10 border-b bg-card px-6 pt-6 pb-4">
								<div className="flex flex-col gap-3">
									<div className="space-y-1.5">
										<Label htmlFor="status" className="text-xs">
											Status
										</Label>
										<Select
											value={statusFilter}
											onValueChange={(value) =>
												value && setStatusFilter(value as ConversationStatus | "all")
											}
										>
											<SelectTrigger className="h-9 w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All</SelectItem>
												<SelectItem value="active">Active</SelectItem>
												<SelectItem value="escalated">Escalated</SelectItem>
												<SelectItem value="closed">Closed</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label htmlFor="search" className="text-xs">
											Search
										</Label>
										<div className="relative">
											<Search className="-translate-y-1/2 absolute top-1/2 left-2 h-3 w-3 text-muted-foreground" />
											<Input
												id="search"
												type="text"
												placeholder="Search by phone..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="h-9 pl-7 text-sm"
											/>
										</div>
									</div>
								</div>
							</div>

							{conversationsQuery.isLoading ? (
								<div className="flex items-center justify-center px-6 py-8">
									<div className="text-muted-foreground text-sm">Loading...</div>
								</div>
							) : conversations.length === 0 ? (
								<div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
									<div className="mb-4 rounded-full bg-muted p-6">
										<MessageCircle className="h-10 w-10 text-muted-foreground" />
									</div>
									<h3 className="mb-2 font-semibold text-lg">No conversations yet</h3>
									<p className="max-w-[280px] text-muted-foreground text-sm">
										Conversations will appear here when customers message you on WhatsApp
									</p>
									{whatsappStatus.data && !whatsappStatus.data.connected && (
										<Button className="mt-6" onClick={() => navigate({ to: "/settings/whatsapp" })}>
											Connect WhatsApp
										</Button>
									)}
								</div>
							) : (
								<div className="flex-1 px-6 py-4 lg:overflow-y-auto">
									<div className="space-y-1">
										{conversations.map((conversation) => (
											<Button
												key={conversation._id}
												variant="ghost"
												onClick={() => handleConversationClick(conversation._id)}
												className={cn(
													"h-auto min-h-20 w-full justify-start rounded-lg p-3",
													"border-l-4",
													getStatusBorderColor(conversation.status),
													selectedConversationId === conversation._id && "bg-muted",
												)}
											>
												<div className="flex w-full items-start gap-3">
													<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
														<span className="font-medium text-muted-foreground text-sm">
															{getCustomerInitials(conversation.customerId)}
														</span>
													</div>
													<div className="min-w-0 flex-1 text-left">
														<div className="flex items-center justify-between gap-2">
															<div className="flex min-w-0 items-center gap-2">
																{conversation.hasUnread && (
																	<span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
																)}
																<span className="truncate font-medium text-sm">
																	{conversation.customerId}
																</span>
															</div>
															<span className="flex-shrink-0 text-muted-foreground text-sm">
																{formatTime(conversation.lastMessageAt)}
															</span>
														</div>
														<p className="mt-1 truncate text-muted-foreground text-sm">
															{truncateMessage(conversation.lastMessagePreview, 60)}
														</p>
														<div className="mt-2">
															<StatusBadge
																status={conversation.status ?? "active"}
																type="conversation"
																assignedTo={conversation.assignedTo ?? undefined}
															/>
														</div>
													</div>
												</div>
											</Button>
										))}
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				<div className="hidden min-w-0 flex-1 lg:block">
					{selectedConversationId ? (
						<ConversationDetail conversationId={selectedConversationId as Id<"conversations">} />
					) : (
						<Card className="flex h-[calc(100vh-220px)] items-center justify-center">
							<div className="text-center">
								<div className="mx-auto mb-4 rounded-full bg-muted p-6">
									<MessageSquare className="h-8 w-8 text-muted-foreground" />
								</div>
								<h3 className="font-semibold text-lg">Select a conversation</h3>
								<p className="mt-1 text-muted-foreground text-sm">
									Choose a conversation from the list to view messages
								</p>
							</div>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}

interface ConversationDetailProps {
	conversationId: Id<"conversations">;
}

function ConversationDetail({ conversationId }: ConversationDetailProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const conversationQuery = useQuery(convexQuery(api.conversations.get, { conversationId }));

	const messagesQuery = useQuery(
		convexQuery(api.conversations.messages, { conversationId, limit: 100 }),
	);

	const conversation = conversationQuery.data;
	const messages = messagesQuery.data?.messages ?? [];

	const takeOver = useMutation(api.conversations.takeOver);
	const handBack = useMutation(api.conversations.handBack);
	const closeConversation = useMutation(api.conversations.close);
	const reopenConversation = useMutation(api.conversations.reopen);
	const [isProcessing, setIsProcessing] = useState(false);
	const [showHandBackDialog, setShowHandBackDialog] = useState(false);

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages]);

	const mapSender = (sender: string): "customer" | "ai" | "human" => {
		if (sender === "customer") return "customer";
		if (sender === "human") return "human";
		return "ai";
	};

	const handleOrderClick = () => {
		if (conversation?.order) {
			window.location.href = `/orders/${conversation.order._id}`;
		}
	};

	const handleTakeOver = async () => {
		setIsProcessing(true);
		try {
			await takeOver({ conversationId });
			toast.success("You are now handling this conversation");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to take over");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleHandBack = async () => {
		setIsProcessing(true);
		try {
			await handBack({ conversationId });
			toast.success("Conversation handed back to AI");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to hand back");
		} finally {
			setIsProcessing(false);
			setShowHandBackDialog(false);
		}
	};

	const handleClose = async () => {
		setIsProcessing(true);
		try {
			await closeConversation({ conversationId });
			toast.success("Conversation closed");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to close conversation");
		} finally {
			setIsProcessing(false);
		}
	};

	const handleReopen = async () => {
		setIsProcessing(true);
		try {
			await reopenConversation({ conversationId });
			toast.success("Conversation reopened");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to reopen conversation");
		} finally {
			setIsProcessing(false);
		}
	};

	if (conversationQuery.isLoading) {
		return (
			<Card className="flex h-[calc(100vh-220px)] items-center justify-center">
				<div className="text-muted-foreground">Loading conversation...</div>
			</Card>
		);
	}

	if (!conversation) {
		return (
			<Card className="flex h-[calc(100vh-220px)] items-center justify-center">
				<div className="text-center">
					<MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h3 className="font-semibold text-lg">Conversation not found</h3>
					<p className="mt-1 text-muted-foreground text-sm">
						This conversation may have been deleted or you don't have access.
					</p>
				</div>
			</Card>
		);
	}

	const isAssignedToSomeone = !!conversation.assignedTo;
	const isClosed = conversation.status === "closed";
	const canSendMessage = isAssignedToSomeone && !isClosed;

	return (
		<Card className="flex h-[calc(100vh-220px)] flex-col">
			<CardHeader className="flex-shrink-0 border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<CardTitle className="font-semibold text-lg">{conversation.customerId}</CardTitle>
						<StatusBadge
							status={conversation.status ?? "active"}
							type="conversation"
							assignedTo={conversation.assignedTo ?? undefined}
						/>
					</div>
					<div className="flex gap-2">
						{!isAssignedToSomeone && !isClosed && (
							<Button size="sm" onClick={handleTakeOver} disabled={isProcessing}>
								{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Take Over
							</Button>
						)}
						{isAssignedToSomeone && !isClosed && (
							<AlertDialog open={showHandBackDialog} onOpenChange={setShowHandBackDialog}>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setShowHandBackDialog(true)}
									disabled={isProcessing}
								>
									{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
									Hand Back
								</Button>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Hand back to AI?</AlertDialogTitle>
										<AlertDialogDescription>
											AI will resume handling this conversation. The customer will receive automated
											responses.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction onClick={handleHandBack} disabled={isProcessing}>
											{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
											Confirm
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						)}
						{!isClosed && (
							<Button size="sm" variant="destructive" onClick={handleClose} disabled={isProcessing}>
								{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Close
							</Button>
						)}
						{isClosed && (
							<Button size="sm" onClick={handleReopen} disabled={isProcessing}>
								{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Reopen
							</Button>
						)}
					</div>
				</div>
			</CardHeader>

			<div className="flex-1 overflow-y-auto">
				{conversation.status === "escalated" && conversation.escalationReason && (
					<div className="mx-4 mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950/30">
						<h4 className="font-medium text-sm text-yellow-800 dark:text-yellow-200">
							Escalation Reason
						</h4>
						<p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
							{conversation.escalationReason}
						</p>
					</div>
				)}

				{conversation.order && (
					<div className="mx-4 mt-4">
						<div className="rounded-lg border bg-muted/30 p-3">
							<div className="mb-2 flex items-center gap-2">
								<ShoppingCart className="h-4 w-4 text-muted-foreground" />
								<span className="font-medium text-sm">Related Order</span>
							</div>
							<div className="flex items-center justify-between text-sm">
								<Button
									variant="link"
									onClick={handleOrderClick}
									className="h-auto p-0 font-medium"
								>
									#{conversation.order.orderNumber}
								</Button>
								<span className="text-muted-foreground capitalize">
									{conversation.order.status}
								</span>
							</div>
						</div>
					</div>
				)}

				<div className="p-4">
					{messagesQuery.isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-muted-foreground text-sm">Loading messages...</div>
						</div>
					) : messages.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 text-center">
							<MessageSquare className="mb-3 h-8 w-8 text-muted-foreground" />
							<p className="text-muted-foreground text-sm">No messages yet</p>
						</div>
					) : (
						<div className="flex flex-col">
							{messages.map((message, index) => {
								const prevMessage = messages[index - 1];
								const isSameSenderAsPrevious = prevMessage && prevMessage.sender === message.sender;
								return (
									<div
										key={message._id}
										className={isSameSenderAsPrevious ? "mt-1" : "mt-4 first:mt-0"}
									>
										<MessageBubble
											sender={mapSender(message.sender)}
											content={message.content}
											timestamp={message.createdAt}
											mediaUrl={message.mediaUrl ?? undefined}
										/>
									</div>
								);
							})}
							<div ref={messagesEndRef} />
						</div>
					)}
				</div>
			</div>

			<div className="flex-shrink-0 border-t">
				<MessageInput conversationId={conversationId} disabled={!canSendMessage} />
			</div>
		</Card>
	);
}
