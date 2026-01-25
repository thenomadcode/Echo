import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ShoppingBag, ChevronRight, Check, ArrowLeft, Facebook } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings_/integrations")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const businesses = useQuery(api.businesses.list);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("echo:activeBusinessId");
      if (stored) {
        setActiveBusinessId(stored);
      }
    }
  }, []);

  useEffect(() => {
    if (businesses && businesses.length > 0 && !activeBusinessId) {
      setActiveBusinessId(businesses[0]._id);
    }
  }, [businesses, activeBusinessId]);

  const shopifyStatus = useQuery(
    api.shopify.getConnectionStatus,
    activeBusinessId ? { businessId: activeBusinessId as never } : "skip"
  );

  const metaStatus = useQuery(
    api.integrations.meta.queries.getConnectionStatus,
    activeBusinessId ? { businessId: activeBusinessId as never } : "skip"
  );

  if (businesses === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div>Loading...</div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  const isShopifyConnected = shopifyStatus?.connected === true;
  const isMetaConnected = metaStatus?.connected === true;

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

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="mt-2 text-muted-foreground">
          Connect your business with external services
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/settings/integrations/shopify" search={{ connected: false, error: undefined }}>
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#96bf48]">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Shopify</CardTitle>
                  <CardDescription className="text-sm">
                    Sync products and orders
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isShopifyConnected ? (
                <Badge variant="success" className="flex items-center gap-1 w-fit">
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link to="/settings/integrations/meta" search={{ connected: false, error: undefined }}>
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1877F2]">
                  <Facebook className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Meta</CardTitle>
                  <CardDescription className="text-sm">
                    Messenger & Instagram DMs
                  </CardDescription>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isMetaConnected ? (
                <Badge variant="success" className="flex items-center gap-1 w-fit">
                  <Check className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
