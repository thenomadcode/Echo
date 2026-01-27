import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import {
  Building2,
  Globe,
  Clock,
  Bot,
  MessageCircle,
  ShoppingBag,
  ChevronRight,
  Loader2,
  Facebook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SettingsSection = "general" | "ai" | "chats" | "shops";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  validateSearch: (search: Record<string, unknown>): { section?: SettingsSection } => {
    const section = search.section as string | undefined;
    if (section === "general" || section === "ai" || section === "chats" || section === "shops") {
      return { section };
    }
    return {};
  },
});

interface SidebarItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "general", label: "General", icon: Building2 },
  { id: "ai", label: "AI & Automation", icon: Bot },
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "shops", label: "Shops", icon: ShoppingBag },
];

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
];

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

function SettingsPage() {
  const { section = "general" } = useSearch({ from: "/_authenticated/settings" });
  const businesses = useQuery(api.businesses.list);
  const updateBusiness = useMutation(api.businesses.update);

  if (businesses === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeBusiness = businesses[0];

  if (!activeBusiness) {
    return (
      <div className="container mx-auto max-w-5xl py-8 px-6">
        <p className="text-muted-foreground">No business found. Please create one first.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 lg:px-6">
      <h1 className="text-2xl font-bold font-heading mb-6">Settings</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-48 flex-shrink-0">
          <nav>
            <ul className="space-y-1">
              {SIDEBAR_ITEMS.map((item) => (
                <li key={item.id}>
                  <Link
                    to="/settings"
                    search={{ section: item.id }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      section === item.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {section === "general" && (
            <GeneralSettings business={activeBusiness} updateBusiness={updateBusiness} />
          )}
          {section === "ai" && (
            <AISettings business={activeBusiness} />
          )}
          {section === "chats" && <ChatsIntegrationsSettings />}
          {section === "shops" && <ShopsIntegrationsSettings />}
        </main>
      </div>
    </div>
  );
}

interface Business {
  _id: Id<"businesses">;
  name: string;
  description?: string;
  logoUrl?: string;
  defaultLanguage: string;
  timezone: string;
  businessHours?: {
    open: string;
    close: string;
    days: number[];
  };
  aiTone?: string;
}

interface SettingsFormProps {
  business: Business;
  updateBusiness: (args: {
    businessId: Id<"businesses">;
    name?: string;
    description?: string;
    logoUrl?: string;
    defaultLanguage?: string;
    timezone?: string;
    businessHours?: { open: string; close: string; days: number[] };
  }) => Promise<string>;
}

function GeneralSettings({ business, updateBusiness }: SettingsFormProps) {
  const form = useForm({
    defaultValues: {
      name: business.name,
      description: business.description || "",
      logoUrl: business.logoUrl || "",
      defaultLanguage: business.defaultLanguage,
      timezone: business.timezone,
      hoursOpen: business.businessHours?.open || "09:00",
      hoursClose: business.businessHours?.close || "17:00",
      hoursDays: business.businessHours?.days || [],
    },
    onSubmit: async ({ value }) => {
      try {
        await updateBusiness({
          businessId: business._id,
          name: value.name,
          description: value.description || undefined,
          logoUrl: value.logoUrl || undefined,
          defaultLanguage: value.defaultLanguage,
          timezone: value.timezone,
          businessHours: {
            open: value.hoursOpen,
            close: value.hoursClose,
            days: value.hoursDays,
          },
        });
        toast.success("Settings saved successfully!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save settings");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Info
          </CardTitle>
          <CardDescription>Update your business profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Business Name</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-11"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Description</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="logoUrl">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Logo URL</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="url"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="h-11"
                />
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Localization
          </CardTitle>
          <CardDescription>Set your default language and timezone</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="defaultLanguage">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Default Language</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => value && field.handleChange(value)}
                >
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder="Select language">
                      {LANGUAGES.find((l) => l.value === field.state.value)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="timezone">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Timezone</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => value && field.handleChange(value)}
                >
                  <SelectTrigger className="w-full h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Business Hours
          </CardTitle>
          <CardDescription>Set your operating hours and days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="hoursOpen">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Open Time</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="time"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-11"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="hoursClose">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Close Time</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="time"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-11"
                  />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="hoursDays">
            {(field) => (
              <div className="space-y-2">
                <Label>Operating Days</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DAYS_OF_WEEK.map((day) => (
                    <label key={day.value} className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={field.state.value.includes(Number(day.value))}
                        onCheckedChange={(checked) => {
                          const dayNum = Number(day.value);
                          if (checked) {
                            field.handleChange([...field.state.value, dayNum].sort());
                          } else {
                            field.handleChange(field.state.value.filter((d: number) => d !== dayNum));
                          }
                        }}
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <StickySaveButton form={form} />
    </form>
  );
}

function StickySaveButton({ form }: { form: { state: { canSubmit: boolean; isSubmitting: boolean }; Subscribe: React.ComponentType<{ children: (state: { canSubmit: boolean; isSubmitting: boolean }) => React.ReactNode }> } }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry?.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0" />
      <div className={cn(
        "sticky bottom-4 flex justify-end bg-background/80 backdrop-blur-sm p-4 -mx-4 rounded-lg transition-shadow",
        isStuck && "border shadow-lg"
      )}>
        <form.Subscribe>
          {(state) => (
            <Button type="submit" disabled={!state.canSubmit || state.isSubmitting} className="h-11">
              {state.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {state.isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </>
  );
}

function AISettings({ business }: { business: Business }) {
  const updateAISettings = useMutation(api.ai.settings.updateSettings);
  
  const form = useForm({
    defaultValues: {
      aiTone: business.aiTone || "",
    },
    onSubmit: async ({ value }) => {
      try {
        await updateAISettings({
          businessId: business._id,
          aiTone: value.aiTone || undefined,
        });
        toast.success("AI settings saved successfully!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save AI settings");
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Personality
          </CardTitle>
          <CardDescription>Customize how your AI assistant communicates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Field name="aiTone">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Tone & Style</Label>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={4}
                  placeholder="Be friendly and helpful. Use casual language. Always recommend our daily specials."
                />
                <p className="text-xs text-muted-foreground">
                  Custom instructions to shape how the AI responds to customers
                </p>
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <StickySaveButton form={form} />
    </form>
  );
}

function ShopifyIntegrationCard() {
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
    activeBusinessId ? { businessId: activeBusinessId as Id<"businesses"> } : "skip"
  );

  const isConnected = shopifyStatus?.connected === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Shopify
        </CardTitle>
        <CardDescription>Sync your product catalog from Shopify</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isConnected
                  ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">
                {isConnected ? "Connected" : "Not Connected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? shopifyStatus.shop
                  : "Import products directly from your Shopify store"}
              </p>
            </div>
          </div>
          <Link to="/settings/integrations/shopify" search={{ connected: false, error: undefined }}>
            <Button variant={isConnected ? "outline" : "default"}>
              {isConnected ? "Configure" : "Connect"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatsIntegrationsSettings() {
  const businesses = useQuery(api.businesses.list);
  const activeBusiness = businesses?.[0];
  const whatsappStatus = useQuery(
    api.integrations.whatsapp.settings.getConnectionStatus,
    activeBusiness ? { businessId: activeBusiness._id } : "skip"
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            WhatsApp Business
          </CardTitle>
          <CardDescription>Connect your WhatsApp to receive customer messages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-full",
                  whatsappStatus?.connected ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
                )}
              >
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">
                  {whatsappStatus?.connected ? "Connected" : "Not Connected"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {whatsappStatus?.connected
                    ? whatsappStatus.phoneNumber || "WhatsApp Business API"
                    : "Connect to start receiving messages"}
                </p>
              </div>
            </div>
            <Link to="/settings/whatsapp">
              <Button variant={whatsappStatus?.connected ? "outline" : "default"}>
                {whatsappStatus?.connected ? "Configure" : "Connect"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <MetaIntegrationCard />
    </div>
  );
}

function ShopsIntegrationsSettings() {
  return (
    <div className="space-y-6">
      <ShopifyIntegrationCard />
    </div>
  );
}

function MetaIntegrationCard() {
  const businesses = useQuery(api.businesses.list);
  const activeBusiness = businesses?.[0];
  const metaStatus = useQuery(
    api.integrations.meta.queries.getConnectionStatus,
    activeBusiness ? { businessId: activeBusiness._id } : "skip"
  );

  const isConnected = metaStatus?.connected === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Facebook className="h-5 w-5" />
          Meta (Messenger & Instagram)
        </CardTitle>
        <CardDescription>Connect Facebook Messenger and Instagram DMs</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isConnected ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"
              )}
            >
              <Facebook className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">
                {isConnected ? "Connected" : "Not Connected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? `${metaStatus.pageName}${metaStatus.instagramUsername ? ` • @${metaStatus.instagramUsername}` : ""}`
                  : "Connect to receive Messenger and Instagram messages"}
              </p>
            </div>
          </div>
          <Link to="/settings/integrations/meta" search={{ connected: false, error: undefined }}>
            <Button variant={isConnected ? "outline" : "default"}>
              {isConnected ? "Configure" : "Connect"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}


