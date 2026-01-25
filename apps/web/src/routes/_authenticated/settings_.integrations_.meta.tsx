import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Facebook } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaConnectButton } from "@/components/integrations/meta-connect-button";
import { MetaConnectionStatus } from "@/components/integrations/meta-connection-status";
import { MetaDisconnectDialog } from "@/components/integrations/meta-disconnect-dialog";

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
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

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

      {isConnected && connectionStatus && activeBusinessId && (
        <div className="space-y-6 max-w-2xl">
          <MetaConnectionStatus
            connectionStatus={connectionStatus}
            businessId={activeBusinessId}
            onDisconnect={() => setShowDisconnectDialog(true)}
          />

          <MetaDisconnectDialog
            businessId={activeBusinessId}
            open={showDisconnectDialog}
            onOpenChange={setShowDisconnectDialog}
          />
        </div>
      )}
    </div>
  );
}
