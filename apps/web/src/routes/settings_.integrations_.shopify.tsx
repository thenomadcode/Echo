import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import SignInForm from "@/components/sign-in-form";
import BusinessSwitcher from "@/components/business-switcher";
import AppNav from "@/components/app-nav";
import UserMenu from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Connected</CardTitle>
              <CardDescription>
                Your Shopify store is connected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Store: <span className="font-medium">{connectionStatus.shop}</span>
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
