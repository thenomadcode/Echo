import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Facebook, Instagram, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MetaConnectButton } from "@/components/integrations/meta-connect-button";

export const Route = createFileRoute("/_authenticated/settings_/integrations_/meta")({
  component: MetaSettingsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    connected: search.connected === "true",
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

function MetaSettingsPage() {
  const { connected, error } = Route.useSearch();
  const businesses = useQuery(api.businesses.list);
  const [activeBusinessId, setActiveBusinessId] = useState<Id<"businesses"> | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const disconnect = useAction(api.integrations.meta.actions.disconnect);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("echo:activeBusinessId");
      if (stored) {
        setActiveBusinessId(stored as Id<"businesses">);
      }
    }
  }, []);

  useEffect(() => {
    if (businesses && businesses.length > 0 && !activeBusinessId) {
      setActiveBusinessId(businesses[0]._id as Id<"businesses">);
    }
  }, [businesses, activeBusinessId]);

  useEffect(() => {
    if (connected) {
      toast.success("Meta connected successfully!");
    }
    if (error) {
      toast.error(`Connection failed: ${error}`);
    }
  }, [connected, error]);

  const connectionStatus = useQuery(
    api.integrations.meta.queries.getConnectionStatus,
    activeBusinessId ? { businessId: activeBusinessId as never } : "skip"
  );

  const handleDisconnect = async () => {
    if (!activeBusinessId) {
      toast.error("No active business selected");
      return;
    }

    setIsDisconnecting(true);

    try {
      const result = await disconnect({
        businessId: activeBusinessId as never,
      });

      if (result.success) {
        toast.success("Meta disconnected successfully");
        setShowDisconnectDialog(false);
      } else {
        toast.error(result.error ?? "Failed to disconnect");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Disconnect failed";
      toast.error(message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (businesses === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  const isConnected = connectionStatus?.connected === true;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link
          to="/settings"
          search={{ section: "integrations" }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Settings
        </Link>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#1877F2]">
          <Facebook className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Meta Integration</h1>
          <p className="text-muted-foreground">
            Connect your Facebook Page and Instagram to receive messages
          </p>
        </div>
      </div>

      {!isConnected && activeBusinessId && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Connect with Facebook</CardTitle>
            <CardDescription>
              Connect your Facebook Page to enable Messenger and Instagram DMs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You'll be redirected to Facebook to authorize Echo to access your Page's messaging.
              Make sure you have admin access to the Facebook Page you want to connect.
            </p>
            <MetaConnectButton businessId={activeBusinessId} className="w-full" />
          </CardContent>
        </Card>
      )}

      {isConnected && connectionStatus && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Connection Status</CardTitle>
                <Badge variant="success" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-[#1877F2]" />
                  <span className="text-sm text-muted-foreground">Facebook Page</span>
                </div>
                <span className="text-sm font-medium">{connectionStatus.pageName}</span>
              </div>
              {connectionStatus.instagramUsername && (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-[#E4405F]" />
                    <span className="text-sm text-muted-foreground">Instagram</span>
                  </div>
                  <span className="text-sm font-medium">@{connectionStatus.instagramUsername}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Webhooks</span>
                <Badge variant={connectionStatus.webhooksSubscribed ? "success" : "secondary"}>
                  {connectionStatus.webhooksSubscribed ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Last Message</span>
                <span className="text-sm font-medium">
                  {connectionStatus.lastMessageAt
                    ? new Date(connectionStatus.lastMessageAt).toLocaleDateString()
                    : "No messages yet"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for this integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Unlink className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-medium">Disconnect Meta</p>
                    <p className="text-xs text-muted-foreground">
                      Remove the connection to your Facebook Page and Instagram
                    </p>
                  </div>
                </div>
                <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                  <AlertDialogTrigger
                    render={
                      <Button variant="destructive" disabled={isDisconnecting}>
                        {isDisconnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          "Disconnect"
                        )}
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Meta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will no longer receive messages from Messenger or Instagram DMs.
                        Existing conversations will be preserved but new messages won't be received.
                        You can reconnect anytime.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          "Disconnect"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
