import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
  User,
  Phone,
  Star,
  MapPin,
  AlertCircle,
  ShoppingBag,
  MessageCircle,
  Heart,
  StickyNote,
  Pencil,
  Loader2,
  Plus,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  component: CustomerDetailPage,
});

type CustomerTier = "regular" | "bronze" | "silver" | "gold" | "vip";
type TabId = "overview" | "orders" | "conversations" | "preferences" | "notes";

const TIER_CONFIG: Record<CustomerTier, { label: string; variant: "default" | "secondary" | "warning" | "info" | "success" }> = {
  regular: { label: "Regular", variant: "secondary" },
  bronze: { label: "Bronze", variant: "default" },
  silver: { label: "Silver", variant: "info" },
  gold: { label: "Gold", variant: "warning" },
  vip: { label: "VIP", variant: "success" },
};

function TierBadge({ tier }: { tier: CustomerTier }) {
  const config = TIER_CONFIG[tier] ?? TIER_CONFIG.regular;
  const showStar = tier === "gold" || tier === "vip";

  return (
    <Badge variant={config.variant} className="gap-1">
      {showStar && <Star className="h-3 w-3 fill-current" />}
      {config.label}
    </Badge>
  );
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "conversations", label: "Conversations", icon: MessageCircle },
  { id: "preferences", label: "Preferences", icon: Heart },
  { id: "notes", label: "Notes", icon: StickyNote },
];

function CustomerDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { customerId } = Route.useParams();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showEditDialog, setShowEditDialog] = useState(false);

  const customerQuery = useQuery(
    convexQuery(api.customers.get, { customerId: customerId as Id<"customers"> })
  );

  const contextQuery = useQuery(
    convexQuery(api.customers.getContext, { customerId: customerId as Id<"customers"> })
  );

  const customer = customerQuery.data;
  const context = contextQuery.data;

  const handleEditSuccess = async () => {
    await queryClient.invalidateQueries();
    setShowEditDialog(false);
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (customerQuery.isLoading) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/customers" })}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Customers
        </Button>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Customer not found</h3>
            <p className="text-sm text-muted-foreground">
              The customer you're looking for doesn't exist or you don't have access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/customers" })}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Customers
      </Button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-semibold">
              {customer.name?.[0]?.toUpperCase() || customer.phone[0]}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold font-heading">
                  {customer.name || "Unknown Customer"}
                </h1>
                <TierBadge tier={customer.tier as CustomerTier} />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <Phone className="h-4 w-4" />
                <span>{customer.phone}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-bold">{customer.totalOrders}</p>
                <p className="text-sm text-muted-foreground">Orders</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(customer.totalSpent)}</p>
                <p className="text-sm text-muted-foreground">Lifetime Spend</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-6 overflow-x-auto" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab customer={customer} context={context} formatCurrency={formatCurrency} formatDate={formatDate} />
      )}
      {activeTab === "orders" && (
        <OrdersTab customerId={customerId as Id<"customers">} formatCurrency={formatCurrency} formatDate={formatDate} navigate={navigate} />
      )}
      {activeTab === "conversations" && (
        <ConversationsTab customerId={customerId as Id<"customers">} formatDate={formatDate} navigate={navigate} />
      )}
      {activeTab === "preferences" && (
        <PreferencesTab context={context} />
      )}
      {activeTab === "notes" && (
        <NotesTab customerId={customerId as Id<"customers">} formatDate={formatDate} />
      )}

      <EditCustomerDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        customer={customer}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}

interface CustomerContext {
  profile: {
    name?: string;
    phone: string;
    tier: string;
    preferredLanguage?: string;
    firstSeenAt: number;
    lastSeenAt: number;
    totalOrders: number;
    totalSpent: number;
  };
  addresses: Array<{ label: string; address: string; isDefault: boolean }>;
  memory: {
    allergies: string[];
    restrictions: string[];
    preferences: string[];
    behaviors: string[];
  };
  businessNotes: string;
}

interface OverviewTabProps {
  customer: {
    _id: Id<"customers">;
    name?: string;
    phone: string;
    tier: string;
    totalOrders: number;
    totalSpent: number;
    firstSeenAt: number;
    lastSeenAt: number;
    preferredLanguage?: string;
  };
  context: CustomerContext | null | undefined;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (timestamp: number) => string;
}

function OverviewTab({ customer, context, formatCurrency, formatDate }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">First Seen</span>
              <span>{formatDate(customer.firstSeenAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Seen</span>
              <span>{formatDate(customer.lastSeenAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Average Order</span>
              <span>
                {customer.totalOrders > 0
                  ? formatCurrency(Math.round(customer.totalSpent / customer.totalOrders))
                  : "-"}
              </span>
            </div>
            {customer.preferredLanguage && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preferred Language</span>
                <span className="capitalize">{customer.preferredLanguage}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AddressesSection customerId={customer._id} />

      {context?.memory?.allergies && context.memory.allergies.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              Allergies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {context.memory.allergies.map((allergy, idx) => (
                <Badge key={idx} variant="destructive">{allergy}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {context && (context.memory?.preferences?.length > 0 || context.memory?.restrictions?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {context.memory.restrictions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">Restrictions</p>
                  <div className="flex flex-wrap gap-1">
                    {context.memory.restrictions.map((r, idx) => (
                      <Badge key={idx} variant="warning" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {context.memory.preferences.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Preferences</p>
                  <div className="flex flex-wrap gap-1">
                    {context.memory.preferences.map((p, idx) => (
                      <Badge key={idx} variant="info" className="text-xs">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {context?.businessNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{context.businessNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface OrdersTabProps {
  customerId: Id<"customers">;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (timestamp: number) => string;
  navigate: ReturnType<typeof useNavigate>;
}

function OrdersTab({ customerId, formatCurrency, formatDate, navigate }: OrdersTabProps) {
  const ordersQuery = useQuery(
    convexQuery(api.orders.listByCustomer, { customerId })
  );

  const orders = ordersQuery.data?.orders ?? [];

  if (ordersQuery.isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShoppingBag className="mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No orders yet</h3>
          <p className="text-sm text-muted-foreground">
            This customer hasn't placed any orders
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 font-medium">Order #</th>
              <th className="text-left p-4 font-medium">Items</th>
              <th className="text-left p-4 font-medium">Status</th>
              <th className="text-right p-4 font-medium">Total</th>
              <th className="text-right p-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order._id}
                onClick={() => navigate({ to: "/orders/$orderId", params: { orderId: order._id } })}
                className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <td className="p-4 font-medium">{order.orderNumber}</td>
                <td className="p-4 text-muted-foreground">{order.items.length} items</td>
                <td className="p-4">
                  <Badge variant={order.status === "delivered" ? "success" : order.status === "cancelled" ? "destructive" : "secondary"}>
                    {order.status}
                  </Badge>
                </td>
                <td className="p-4 text-right">{formatCurrency(order.total, order.currency)}</td>
                <td className="p-4 text-right text-muted-foreground">{formatDate(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

interface ConversationsTabProps {
  customerId: Id<"customers">;
  formatDate: (timestamp: number) => string;
  navigate: ReturnType<typeof useNavigate>;
}

function ConversationsTab({ customerId, formatDate, navigate }: ConversationsTabProps) {
  const conversationsQuery = useQuery(
    convexQuery(api.conversations.listByCustomer, { customerId })
  );

  const summariesQuery = useQuery(
    convexQuery(api.conversationSummaries.listByCustomer, { customerId })
  );

  const conversations = conversationsQuery.data ?? [];
  const summaries = summariesQuery.data ?? [];

  const summaryMap = new Map(summaries.map(s => [s.conversationId, s]));

  if (conversationsQuery.isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Loading conversations...</div>;
  }

  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageCircle className="mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No conversations yet</h3>
          <p className="text-sm text-muted-foreground">
            Conversations with this customer will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => {
        const summary = summaryMap.get(conv._id);
        return (
          <Card
            key={conv._id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate({ to: "/conversations/$conversationId", params: { conversationId: conv._id } })}
          >
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={conv.status === "closed" ? "secondary" : conv.status === "escalated" ? "warning" : "default"}>
                      {conv.status}
                    </Badge>
                    {summary?.sentiment && (
                      <Badge variant={summary.sentiment === "positive" ? "success" : summary.sentiment === "negative" ? "destructive" : "secondary"}>
                        {summary.sentiment}
                      </Badge>
                    )}
                  </div>
                  {summary ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">{summary.summary}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No summary available</p>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                  {formatDate(conv.createdAt)}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface PreferencesTabProps {
  context: CustomerContext | null | undefined;
}

function PreferencesTab({ context }: PreferencesTabProps) {
  const categories = [
    { key: "allergies", label: "Allergies", color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/30", items: context?.memory?.allergies ?? [] },
    { key: "restrictions", label: "Restrictions", color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/30", items: context?.memory?.restrictions ?? [] },
    { key: "preferences", label: "Preferences", color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/30", items: context?.memory?.preferences ?? [] },
    { key: "behaviors", label: "Behaviors", color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-50 dark:bg-gray-950/30", items: context?.memory?.behaviors ?? [] },
  ] as const;

  const hasAnyPreferences = categories.some(c => c.items.length > 0);

  if (!hasAnyPreferences) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Heart className="mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No preferences recorded</h3>
          <p className="text-sm text-muted-foreground">
            Preferences will be extracted from conversations automatically
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {categories.map((category) => {
        if (category.items.length === 0) return null;
        return (
          <Card key={category.key} className={category.key === "allergies" ? "border-red-200 dark:border-red-900" : ""}>
            <CardHeader>
              <CardTitle className={cn("text-base", category.color)}>
                {category.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {category.items.map((item, idx) => (
                  <div
                    key={idx}
                    className={cn("rounded-md px-3 py-2 text-sm", category.bgColor)}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface NotesTabProps {
  customerId: Id<"customers">;
  formatDate: (timestamp: number) => string;
}

function NotesTab({ customerId, formatDate }: NotesTabProps) {
  const notesQuery = useQuery(
    convexQuery(api.customerNotes.list, { customerId })
  );

  const notes = notesQuery.data ?? [];

  if (notesQuery.isLoading) {
    return <div className="text-muted-foreground py-8 text-center">Loading notes...</div>;
  }

  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <StickyNote className="mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No notes yet</h3>
          <p className="text-sm text-muted-foreground">
            Add notes about this customer for your team
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <Card key={note._id}>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                {note.staffOnly && (
                  <Badge variant="secondary" className="mt-2">Staff Only</Badge>
                )}
              </div>
              <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                {formatDate(note.createdAt)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    _id: Id<"customers">;
    name?: string;
    tier: string;
    preferredLanguage?: string;
  };
  onSuccess: () => void;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
] as const;

function EditCustomerDialog({ open, onOpenChange, customer, onSuccess }: EditCustomerDialogProps) {
  const updateCustomer = useMutation(api.customers.update);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState(customer.name ?? "");
  const [tier, setTier] = useState<CustomerTier | "auto">(customer.tier as CustomerTier);
  const [language, setLanguage] = useState(customer.preferredLanguage ?? "en");

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const updates: {
        customerId: Id<"customers">;
        name?: string;
        tier?: CustomerTier;
        preferredLanguage?: string;
      } = {
        customerId: customer._id,
      };

      if (name !== customer.name) {
        updates.name = name || undefined;
      }

      if (tier !== "auto" && tier !== customer.tier) {
        updates.tier = tier;
      }

      if (language !== customer.preferredLanguage) {
        updates.preferredLanguage = language;
      }

      await updateCustomer(updates);
      toast.success("Customer updated successfully");
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update customer profile information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tier">Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v as CustomerTier | "auto")}>
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (based on orders)</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select Auto to let the system calculate tier based on order history
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">Preferred Language</Label>
            <Select value={language} onValueChange={(v) => v && setLanguage(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddressesSectionProps {
  customerId: Id<"customers">;
}

function AddressesSection({ customerId }: AddressesSectionProps) {
  const queryClient = useQueryClient();
  const addressesQuery = useQuery(
    convexQuery(api.customerAddresses.list, { customerId })
  );
  const addAddress = useMutation(api.customerAddresses.add);
  const updateAddress = useMutation(api.customerAddresses.update);
  const deleteAddress = useMutation(api.customerAddresses.deleteAddress);
  const setDefaultAddress = useMutation(api.customerAddresses.setDefault);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAddress, setEditingAddress] = useState<{ _id: Id<"customerAddresses">; label: string; address: string } | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<Id<"customerAddresses"> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");

  const addresses = addressesQuery.data ?? [];

  const handleAdd = async () => {
    if (!label.trim() || !address.trim()) return;
    setIsSubmitting(true);
    try {
      await addAddress({ customerId, label: label.trim(), address: address.trim() });
      toast.success("Address added");
      await queryClient.invalidateQueries();
      setShowAddDialog(false);
      setLabel("");
      setAddress("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add address");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingAddress || !label.trim() || !address.trim()) return;
    setIsSubmitting(true);
    try {
      await updateAddress({ addressId: editingAddress._id, label: label.trim(), address: address.trim() });
      toast.success("Address updated");
      await queryClient.invalidateQueries();
      setEditingAddress(null);
      setLabel("");
      setAddress("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update address");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAddressId) return;
    setIsSubmitting(true);
    try {
      await deleteAddress({ addressId: deletingAddressId });
      toast.success("Address deleted");
      await queryClient.invalidateQueries();
      setDeletingAddressId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete address");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (addressId: Id<"customerAddresses">) => {
    try {
      await setDefaultAddress({ addressId });
      toast.success("Default address updated");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set default address");
    }
  };

  const openEditDialog = (addr: { _id: Id<"customerAddresses">; label: string; address: string }) => {
    setEditingAddress(addr);
    setLabel(addr.label);
    setAddress(addr.address);
  };

  const closeDialogs = () => {
    setShowAddDialog(false);
    setEditingAddress(null);
    setLabel("");
    setAddress("");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Saved Addresses
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {addresses.length > 0 ? (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr._id} className="flex items-start gap-2 group">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{addr.label}</span>
                      {addr.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{addr.address}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md hover:bg-accent">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(addr)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {!addr.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefault(addr._id)}>
                          <Star className="h-4 w-4 mr-2" />
                          Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeletingAddressId(addr._id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No saved addresses</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) closeDialogs(); else setShowAddDialog(true); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Address</DialogTitle>
            <DialogDescription>Add a new address for this customer</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-label">Label</Label>
              <Input id="add-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Home, Work" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-address">Address</Label>
              <Input id="add-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleAdd} disabled={isSubmitting || !label.trim() || !address.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingAddress} onOpenChange={(open) => { if (!open) closeDialogs(); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
            <DialogDescription>Update address information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-label">Label</Label>
              <Input id="edit-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Home, Work" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isSubmitting || !label.trim() || !address.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAddressId} onOpenChange={(open) => { if (!open) setDeletingAddressId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
