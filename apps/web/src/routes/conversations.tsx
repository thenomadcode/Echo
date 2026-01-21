import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery as useConvexQuery, useMutation } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Search, ShoppingCart, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import AppNav from "@/components/app-nav";
import BusinessSwitcher from "@/components/business-switcher";
import { MessageBubble } from "@/components/conversation/MessageBubble";
import { MessageInput } from "@/components/conversation/MessageInput";
import { StatusBadge } from "@/components/conversation/StatusBadge";
import { NotificationBell } from "@/components/NotificationBell";
import SignInForm from "@/components/sign-in-form";
import UserMenu from "@/components/user-menu";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conversations")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): { conversationId?: string } => ({
    conversationId: typeof search.conversationId === "string" ? search.conversationId : undefined,
  }),
});

type ConversationStatus = "active" | "escalated" | "closed";

function RouteComponent() {
  return (
    <>
      <Authenticated>
        <ConversationsPageContent />
      </Authenticated>
      <Unauthenticated>
        <div className="mx-auto mt-10 max-w-md p-6">
          <SignInForm />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <div>Loading...</div>
        </div>
      </AuthLoading>
    </>
  );
}

function ConversationsPageContent() {
  const navigate = useNavigate();
  const businesses = useConvexQuery(api.businesses.list, {});

  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (businesses === undefined) return;

    if (businesses.length === 0) {
      navigate({ to: "/onboarding" });
      return;
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("echo:activeBusinessId");
      if (stored && businesses.find((b) => b._id === stored)) {
        setActiveBusinessId(stored);
      } else {
        setActiveBusinessId(businesses[0]?._id || null);
      }
    }
  }, [businesses, navigate]);

  if (businesses === undefined || !activeBusinessId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <ConversationsPage businessId={activeBusinessId as Id<"businesses">} />;
}

interface ConversationsPageProps {
  businessId: Id<"businesses">;
}

function ConversationsPage({ businessId }: ConversationsPageProps) {
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
    })
  );

  const conversations = conversationsQuery.data?.conversations ?? [];

  const truncateMessage = (message: string | null, maxLength: number = 50) => {
    if (!message) return "-";
    if (message.length <= maxLength) return message;
    return `${message.slice(0, maxLength)}...`;
  };

  const formatTime = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const handleConversationClick = useCallback((id: string) => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      navigate({ to: "/conversations", search: { conversationId: id } });
    } else {
      navigate({ to: "/conversations/$conversationId", params: { conversationId: id } });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
            <AppNav />
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:gap-6">
          <div className="w-full lg:w-[400px] lg:flex-shrink-0">
            <Card className="lg:h-[calc(100vh-140px)] lg:flex lg:flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle>Conversations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 lg:overflow-hidden lg:flex lg:flex-col">
                <div className="mb-4 flex-shrink-0">
                  <div className="flex flex-col gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="status" className="text-xs">Status</Label>
                      <select
                        id="status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ConversationStatus | "all")}
                        className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="escalated">Escalated</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="search" className="text-xs">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="search"
                          type="text"
                          placeholder="Search by phone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-8 pl-7 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {conversationsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 rounded-full bg-muted p-4">
                      <MessageSquare className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mb-1 text-sm font-semibold">No conversations</h3>
                    <p className="text-xs text-muted-foreground">
                      Conversations appear when customers message via WhatsApp
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 lg:overflow-y-auto lg:-mx-6 lg:px-6">
                    <div className="space-y-1">
                      {conversations.map((conversation) => (
                        <button
                          key={conversation._id}
                          type="button"
                          onClick={() => handleConversationClick(conversation._id)}
                          className={cn(
                            "w-full text-left rounded-lg p-3 min-h-[72px] transition-colors hover:bg-muted/50",
                            selectedConversationId === conversation._id && "bg-muted",
                            conversation.status === "escalated" && "border-l-2 border-l-red-500"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {conversation.hasUnread && (
                                <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-sm truncate">
                                {conversation.customerId}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatTime(conversation.lastMessageAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground truncate">
                            {truncateMessage(conversation.lastMessagePreview, 60)}
                          </p>
                          <div className="mt-2">
                            <StatusBadge
                              status={conversation.status as ConversationStatus}
                              assignedTo={conversation.assignedTo ?? undefined}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="hidden lg:block flex-1 min-w-0">
            {selectedConversationId ? (
              <ConversationDetail conversationId={selectedConversationId as Id<"conversations">} />
            ) : (
              <Card className="h-[calc(100vh-140px)] flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 rounded-full bg-muted p-6">
                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">Select a conversation</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a conversation from the list to view messages
                  </p>
                </div>
              </Card>
            )}
          </div>
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

  const conversationQuery = useQuery(
    convexQuery(api.conversations.get, {
      conversationId,
    })
  );

  const messagesQuery = useQuery(
    convexQuery(api.conversations.messages, {
      conversationId,
      limit: 100,
    })
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
      <Card className="h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-muted-foreground">Loading conversation...</div>
      </Card>
    );
  }

  if (!conversation) {
    return (
      <Card className="h-[calc(100vh-140px)] flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Conversation not found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
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
    <Card className="h-[calc(100vh-140px)] flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold">
              {conversation.customerId}
            </CardTitle>
            <StatusBadge
              status={conversation.status as ConversationStatus}
              assignedTo={conversation.assignedTo ?? undefined}
            />
          </div>
          <div className="flex gap-2">
            {!isAssignedToSomeone && !isClosed && (
              <Button
                size="sm"
                onClick={handleTakeOver}
                disabled={isProcessing}
              >
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
                      AI will resume handling this conversation. The customer will receive automated responses.
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
              <Button
                size="sm"
                variant="destructive"
                onClick={handleClose}
                disabled={isProcessing}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Close
              </Button>
            )}
            {isClosed && (
              <Button
                size="sm"
                onClick={handleReopen}
                disabled={isProcessing}
              >
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
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
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
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Related Order</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleOrderClick}
                  className="font-medium text-primary hover:underline"
                >
                  #{conversation.order.orderNumber}
                </button>
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
              <div className="text-sm text-muted-foreground">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message._id}
                  sender={mapSender(message.sender)}
                  content={message.content}
                  timestamp={message.createdAt}
                  mediaUrl={message.mediaUrl ?? undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 border-t">
        <MessageInput
          conversationId={conversationId}
          disabled={!canSendMessage}
        />
      </div>
    </Card>
  );
}
