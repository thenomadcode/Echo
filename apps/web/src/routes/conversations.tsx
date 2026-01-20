import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useQuery as useConvexQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Search } from "lucide-react";
import { useEffect, useState } from "react";

import AppNav from "@/components/app-nav";
import BusinessSwitcher from "@/components/business-switcher";
import { StatusBadge } from "@/components/conversation/StatusBadge";
import SignInForm from "@/components/sign-in-form";
import UserMenu from "@/components/user-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conversations")({
  component: RouteComponent,
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

  const handleRowClick = (conversationId: Id<"conversations">) => {
    window.location.href = `/conversations/${conversationId}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BusinessSwitcher />
            <AppNav />
          </div>
          <UserMenu />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Conversations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="space-y-2 md:w-48">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ConversationStatus | "all")}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="escalated">Escalated</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="space-y-2 md:flex-1">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="search"
                      type="text"
                      placeholder="Search by customer phone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
            </div>

            {conversationsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading conversations...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-muted p-6">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No conversations yet</h3>
                <p className="text-sm text-muted-foreground">
                  Conversations will appear here when customers message your business via WhatsApp
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Last Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversations.map((conversation) => (
                    <TableRow
                      key={conversation._id}
                      onClick={() => handleRowClick(conversation._id)}
                      className={cn(
                        "cursor-pointer",
                        conversation.status === "escalated" && "bg-red-50 dark:bg-red-950/20"
                      )}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {conversation.hasUnread && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                          )}
                          <span>{conversation.customerId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs">
                        {truncateMessage(conversation.lastMessagePreview)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={conversation.status as ConversationStatus}
                          assignedTo={conversation.assignedTo ?? undefined}
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatTime(conversation.lastMessageAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
