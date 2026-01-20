import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { ArrowLeft, MessageSquare, ShoppingCart } from "lucide-react";
import { useEffect, useRef } from "react";

import AppNav from "@/components/app-nav";
import BusinessSwitcher from "@/components/business-switcher";
import { MessageBubble } from "@/components/conversation/MessageBubble";
import { StatusBadge } from "@/components/conversation/StatusBadge";
import SignInForm from "@/components/sign-in-form";
import UserMenu from "@/components/user-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/conversations_/$conversationId")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <Authenticated>
        <ConversationDetailContent />
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

function ConversationDetailContent() {
  const navigate = useNavigate();
  const { conversationId } = Route.useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationQuery = useQuery(
    convexQuery(api.conversations.get, {
      conversationId: conversationId as Id<"conversations">,
    })
  );

  const messagesQuery = useQuery(
    convexQuery(api.conversations.messages, {
      conversationId: conversationId as Id<"conversations">,
      limit: 100,
    })
  );

  const conversation = conversationQuery.data;
  const messages = messagesQuery.data?.messages ?? [];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (conversationQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (conversation === null || conversation === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BusinessSwitcher />
              <AppNav />
            </div>
            <UserMenu />
          </div>

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
                The conversation you're looking for doesn't exist or you don't have access to it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const mapSender = (sender: string): "customer" | "ai" | "human" => {
    if (sender === "customer") return "customer";
    if (sender === "human") return "human";
    return "ai";
  };

  const handleOrderClick = () => {
    if (conversation.order) {
      navigate({ to: "/orders_/$orderId", params: { orderId: conversation.order._id } });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
            <AppNav />
          </div>
          <UserMenu />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/conversations" })}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold">
                  {conversation.customerId}
                </CardTitle>
                <StatusBadge
                  status={conversation.status as "active" | "escalated" | "closed"}
                  assignedTo={conversation.assignedTo ?? undefined}
                />
              </div>
            </CardHeader>
          </Card>

          {conversation.status === "escalated" && conversation.escalationReason && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                    Escalation Reason
                  </h4>
                  <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    {conversation.escalationReason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {conversation.order && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <CardTitle>Related Order</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Number</span>
                    <button
                      type="button"
                      onClick={handleOrderClick}
                      className="font-medium text-primary hover:underline"
                    >
                      #{conversation.order.orderNumber}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize">{conversation.order.status}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                {messagesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading messages...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MessageSquare className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No messages yet</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 py-4">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
