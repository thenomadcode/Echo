import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Users, Search, ChevronLeft, ChevronRight, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/customers/")({
  component: CustomersPage,
});

type CustomerTier = "regular" | "bronze" | "silver" | "gold" | "vip";
type SortBy = "lastSeenAt" | "totalOrders" | "totalSpent" | "createdAt";

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

function CustomersPage() {
  const businesses = useConvexQuery(api.businesses.list, {});

  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (businesses === undefined) return;

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("echo:activeBusinessId");
      if (stored && businesses.find((b) => b._id === stored)) {
        setActiveBusinessId(stored);
      } else {
        setActiveBusinessId(businesses[0]?._id || null);
      }
    }
  }, [businesses]);

  if (businesses === undefined || !activeBusinessId) {
    return null;
  }

  return <CustomersContent businessId={activeBusinessId as Id<"businesses">} />;
}

interface CustomersContentProps {
  businessId: Id<"businesses">;
}

const ITEMS_PER_PAGE = 10;

function CustomersContent({ businessId }: CustomersContentProps) {
  const navigate = useNavigate();
  const [tierFilter, setTierFilter] = useState<CustomerTier | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("lastSeenAt");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const customersQuery = useQuery(
    convexQuery(api.customers.list, {
      businessId,
      tier: tierFilter === "all" ? undefined : tierFilter,
      sortBy,
      limit: 100,
    })
  );

  const allCustomers = customersQuery.data?.customers ?? [];

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return allCustomers;
    const query = searchQuery.toLowerCase();
    return allCustomers.filter((customer) => {
      const nameMatch = customer.name?.toLowerCase().includes(query);
      const phoneMatch = customer.phone.toLowerCase().includes(query);
      return nameMatch || phoneMatch;
    });
  }, [allCustomers, searchQuery]);

  const totalCustomers = filteredCustomers.length;
  const totalPages = Math.ceil(totalCustomers / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalCustomers);
  const customers = filteredCustomers.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tierFilter, sortBy]);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const formatSmartDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleRowClick = (customerId: Id<"customers">) => {
    navigate({ to: "/customers/$customerId", params: { customerId } });
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <h1 className="text-2xl font-bold font-heading mb-6">Customers</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Customers</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="space-y-2 flex-1 md:max-w-xs">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2 md:w-40">
                <Label htmlFor="tier">Tier</Label>
                <Select
                  value={tierFilter}
                  onValueChange={(value) => value && setTierFilter(value as CustomerTier | "all")}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:w-48">
                <Label htmlFor="sort">Sort By</Label>
                <Select
                  value={sortBy}
                  onValueChange={(value) => value && setSortBy(value as SortBy)}
                >
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastSeenAt">Last Seen</SelectItem>
                    <SelectItem value="totalOrders">Total Orders</SelectItem>
                    <SelectItem value="totalSpent">Total Spent</SelectItem>
                    <SelectItem value="createdAt">Date Added</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {customersQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading customers...</div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-muted p-6">
                <Users className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">No customers yet</h3>
              <p className="text-sm text-muted-foreground max-w-[320px]">
                Customers will appear here when they message you on WhatsApp
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-center">Orders</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-right">Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow
                      key={customer._id}
                      onClick={() => handleRowClick(customer._id)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        {customer.name || "Unknown"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.phone}
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={customer.tier as CustomerTier} />
                      </TableCell>
                      <TableCell className="text-center">
                        {customer.totalOrders}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(customer.totalSpent)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatSmartDate(customer.lastSeenAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{endIndex} of {totalCustomers} customers
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
