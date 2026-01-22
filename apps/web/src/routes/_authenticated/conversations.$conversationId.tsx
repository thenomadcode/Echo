import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  MapPin, 
  MessageSquare, 
  ShoppingCart, 
  Star, 
  User, 
  Loader2, 
  StickyNote 
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/conversations/$conversationId")({
  component: ConversationDetailPage,
});

const PANEL_COLLAPSED_KEY = "echo-customer-panel-collapsed";

function getTierVariant(tier: string): "default" | "secondary" | "destructive" | "outline" {
  switch (tier) {
    case "vip":
    case "gold":
      return "default";
    case "silver":
    case "bronze":
      return "secondary";
    default:
      return "outline";
  }
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function CustomerContextPanel({ 
  customerId, 
  isCollapsed, 
  onToggle 
}: { 
  customerId: Id<"customers">; 
  isCollapsed: boolean; 
  onToggle: () => void;
}) {
  const contextQuery = useQuery(
    convexQuery(api.customers.getContext, { customerId })
  );

  const context = contextQuery.data;
  const isLoading = contextQuery.isLoading;

  if (isLoading) {
    return (
      <div className={`border-l bg-muted/30 transition-all duration-300 ${isCollapsed ? "w-10" : "w-80"}`}>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggle}
          className="w-10 h-10 border-b"
        >
          {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        {!isCollapsed && (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  if (!context) {
    return null;
  }

  const defaultAddress = context.addresses.find(a => a.isDefault);
  const hasAllergies = context.memory.allergies.length > 0;

  return (
    <div className={`border-l bg-muted/30 transition-all duration-300 flex flex-col ${isCollapsed ? "w-10" : "w-80"}`}>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onToggle}
        className="w-10 h-10 border-b flex-shrink-0"
        aria-label={isCollapsed ? "Expand customer panel" : "Collapse customer panel"}
      >
        {isCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center pt-4 gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          {hasAllergies && (
            <span title="Has allergies">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </span>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">
                {context.profile.name || context.profile.phone}
              </h3>
              <Badge variant={getTierVariant(context.profile.tier)} className="flex-shrink-0">
                {context.profile.tier === "vip" || context.profile.tier === "gold" ? (
                  <Star className="h-3 w-3 mr-1 fill-current" />
                ) : null}
                {context.profile.tier.charAt(0).toUpperCase() + context.profile.tier.slice(1)}
              </Badge>
            </div>
            {context.profile.name && (
              <p className="text-sm text-muted-foreground">{context.profile.phone}</p>
            )}
          </div>

          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Orders:</span>{" "}
              <span className="font-medium">{context.profile.totalOrders}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Spent:</span>{" "}
              <span className="font-medium">{formatCurrency(context.profile.totalSpent)}</span>
            </div>
          </div>

          {defaultAddress && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Default Address
              </div>
              <p className="text-sm text-muted-foreground pl-5">
                {defaultAddress.label}: {defaultAddress.address}
              </p>
            </div>
          )}

          {hasAllergies && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
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
              <p className="text-sm font-medium">Restrictions</p>
              <div className="flex flex-wrap gap-1">
                {context.memory.restrictions.map((restriction, i) => (
                  <Badge key={i} variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    {restriction}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {context.memory.preferences.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Preferences</p>
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
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                Notes
              </div>
              <p className="text-sm text-muted-foreground pl-5 whitespace-pre-wrap line-clamp-3">
                {context.businessNotes}
              </p>
            </div>
          )}

          <div className="pt-2">
            <Link
              to="/customers/$customerId"
              params={{ customerId }}
              className="text-sm text-primary hover:underline"
            >
              View Full Profile →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationDetailPage() {
  const navigate = useNavigate();
  const { conversationId } = Route.useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationQuery = useQuery(
    convexQuery(api.conversations.get, { conversationId: conversationId as Id<"conversations"> })
  );

  const messagesQuery = useQuery(
    convexQuery(api.conversations.messages, { 
      conversationId: conversationId as Id<"conversations">, 
      limit: 100 
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
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PANEL_COLLAPSED_KEY) === "true";
  });

  const togglePanel = () => {
    setIsPanelCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem(PANEL_COLLAPSED_KEY, String(newValue));
      return newValue;
    });
  };

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

  const handleTakeOver = async () => {
    setIsProcessing(true);
    try {
      await takeOver({ conversationId: conversationId as Id<"conversations"> });
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
      await handBack({ conversationId: conversationId as Id<"conversations"> });
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
      await closeConversation({ conversationId: conversationId as Id<"conversations"> });
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
      await reopenConversation({ conversationId: conversationId as Id<"conversations"> });
      toast.success("Conversation reopened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reopen conversation");
    } finally {
      setIsProcessing(false);
    }
  };

  if (conversationQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading conversation...</div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/conversations" })}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Conversation not found</h3>
            <p className="text-sm text-muted-foreground">
              This conversation may have been deleted or you don't have access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAssignedToSomeone = !!conversation.assignedTo;
  const isClosed = conversation.status === "closed";
  const canSendMessage = isAssignedToSomeone && !isClosed;
  const hasCustomerRecord = !!conversation.customerRecordId;

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/conversations" })}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Conversations
      </Button>

      <div className="flex h-[calc(100vh-220px)]">
        <Card className="flex flex-col flex-1 min-w-0">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-semibold">
                {conversation.customerId}
              </CardTitle>
              <StatusBadge
                status={conversation.status ?? "active"}
                type="conversation"
                assignedTo={conversation.assignedTo ?? undefined}
              />
            </div>
            <div className="flex flex-wrap gap-2">
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
                      <AlertDialogTitle>Hand Back to AI</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to hand this conversation back to the AI assistant?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Control</AlertDialogCancel>
                      <AlertDialogAction onClick={handleHandBack} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Hand Back
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
                  <Button
                    variant="link"
                    onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: conversation.order!._id } })}
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
                <div className="text-sm text-muted-foreground">Loading messages...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
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
          <MessageInput
            conversationId={conversationId as Id<"conversations">}
            disabled={!canSendMessage}
          />
        </div>
        </Card>

        {hasCustomerRecord && (
          <CustomerContextPanel
            customerId={conversation.customerRecordId as Id<"customers">}
            isCollapsed={isPanelCollapsed}
            onToggle={togglePanel}
          />
        )}
      </div>
    </div>
  );
}
