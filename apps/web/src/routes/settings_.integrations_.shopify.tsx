import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, ShoppingBag, Download, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import SignInForm from "@/components/sign-in-form";
import BusinessSwitcher from "@/components/business-switcher";
import AppNav from "@/components/app-nav";
import UserMenu from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SyncStatus } from "@/components/shopify/SyncStatus";

export const Route = createFileRoute("/settings_/integrations_/shopify")({
  component: ShopifySettingsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    connected: search.connected === "true",
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

function ShopifySettingsPage() {
  return (
    <>
      <Authenticated>
        <ShopifySettingsContent />
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

function ShopifySettingsContent() {
  const navigate = useNavigate();
  const { connected, error } = Route.useSearch();
  const businesses = useQuery(api.businesses.list);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [shopUrl, setShopUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const getAuthUrl = useMutation(api.shopify.getAuthUrl);
  const importProducts = useAction(api.shopify.importProducts);
  const syncProducts = useAction(api.shopify.syncProducts);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("echo:activeBusinessId");
      if (stored) {
        setActiveBusinessId(stored);
      }
    }
  }, []);

  useEffect(() => {
    if (businesses !== undefined && businesses.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [businesses, navigate]);

  useEffect(() => {
    if (businesses && businesses.length > 0 && !activeBusinessId) {
      setActiveBusinessId(businesses[0]._id);
    }
  }, [businesses, activeBusinessId]);

  useEffect(() => {
    if (connected) {
      toast.success("Shopify connected successfully!");
    }
    if (error) {
      toast.error(`Connection failed: ${error}`);
    }
  }, [connected, error]);

  const connectionStatus = useQuery(
    api.shopify.getConnectionStatus,
    activeBusinessId ? { businessId: activeBusinessId as never } : "skip"
  );

  const handleImport = async () => {
    if (!activeBusinessId) {
      toast.error("No active business selected");
      return;
    }

    setIsImporting(true);

    try {
      const result = await importProducts({
        businessId: activeBusinessId as never,
      });

      if (result.errors.length === 0) {
        toast.success(`Imported ${result.imported} products successfully!`);
      } else if (result.imported > 0) {
        toast.warning(
          `Imported ${result.imported} products with ${result.errors.length} errors. Skipped ${result.skipped} products.`
        );
      } else {
        toast.error(`Import failed: ${result.errors[0]}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSync = async () => {
    if (!activeBusinessId) {
      toast.error("No active business selected");
      return;
    }

    setIsSyncing(true);

    try {
      const result = await syncProducts({
        businessId: activeBusinessId as never,
      });

      if (result.errors.length === 0) {
        toast.success(
          `Sync complete: ${result.updated} updated, ${result.added} added, ${result.removed} removed`
        );
      } else if (result.updated + result.added + result.removed > 0) {
        toast.warning(
          `Sync completed with errors: ${result.updated} updated, ${result.added} added, ${result.removed} removed. ${result.errors.length} errors occurred.`
        );
      } else {
        toast.error(`Sync failed: ${result.errors[0]}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnect = async () => {
    if (!activeBusinessId) {
      toast.error("No active business selected");
      return;
    }

    const trimmedShop = shopUrl.trim();
    if (!trimmedShop) {
      toast.error("Please enter your Shopify store URL");
      return;
    }

    setIsConnecting(true);

    try {
      const result = await getAuthUrl({
        businessId: activeBusinessId as never,
        shop: trimmedShop,
      });

      window.location.href = result.authUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start connection";
      toast.error(message);
      setIsConnecting(false);
    }
  };

  if (businesses === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  const isConnected = connectionStatus?.connected === true;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <BusinessSwitcher />
            <AppNav />
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            to="/settings/integrations"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Integrations
          </Link>
        </div>

        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#96bf48]">
            <ShoppingBag className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Shopify Integration</h1>
            <p className="text-muted-foreground">
              Sync your products and orders with Shopify
            </p>
          </div>
        </div>

        {!isConnected && (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Connect Shopify</CardTitle>
              <CardDescription>
                Enter your Shopify store URL to connect
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shopUrl">Store URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="shopUrl"
                    placeholder="mystore"
                    value={shopUrl}
                    onChange={(e) => setShopUrl(e.target.value)}
                    disabled={isConnecting}
                  />
                  <span className="text-muted-foreground whitespace-nowrap">
                    .myshopify.com
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your store name or full URL (e.g., mystore or mystore.myshopify.com)
                </p>
              </div>
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !shopUrl.trim()}
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect Shopify"
                )}
              </Button>
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
                  <span className="text-sm text-muted-foreground">Store</span>
                  <span className="text-sm font-medium">{connectionStatus.shop}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last Sync</span>
                  <SyncStatus
                    lastSyncAt={connectionStatus.lastSyncAt ?? null}
                    status={connectionStatus.lastSyncStatus ?? null}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
                <CardDescription>
                  Import and sync products from your Shopify store
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">Import products from Shopify</span>
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || isSyncing}
                    variant="outline"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Import Products
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">Sync products with Shopify</span>
                  </div>
                  <Button
                    onClick={handleSync}
                    disabled={isSyncing || isImporting}
                    variant="outline"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync Now
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-sm text-muted-foreground">
                    View all imported products
                  </span>
                  <Link to="/products">
                    <Button variant="link" className="px-0">
                      View Products
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sync Options</CardTitle>
                <CardDescription>
                  Configure how data syncs between Echo and Shopify
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SyncOption
                  id="auto-sync-products"
                  label="Auto-sync products when changed in Shopify"
                  description="Products will be automatically updated when you make changes in Shopify"
                  defaultChecked={true}
                />
                <SyncOption
                  id="create-orders"
                  label="Create orders in Shopify"
                  description="Orders placed through Echo will be created in your Shopify store"
                  defaultChecked={true}
                />
                <SyncOption
                  id="sync-order-status"
                  label="Sync order status back to Shopify"
                  description="Order status updates in Echo will be reflected in Shopify"
                  defaultChecked={false}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function SyncOption({
  id,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-start space-x-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => setChecked(value === true)}
        className="mt-1"
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="font-medium cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
