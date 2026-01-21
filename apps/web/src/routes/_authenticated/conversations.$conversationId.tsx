import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import { ArrowLeft, MessageSquare, ShoppingCart, Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/conversations/$conversationId")({
  component: ConversationDetailPage,
});

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

      <Card className="flex flex-col h-[calc(100vh-220px)]">
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
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: conversation.order!._id } })}
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
    </div>
  );
}
