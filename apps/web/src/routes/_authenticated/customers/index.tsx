import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { useBusinessContext } from "@/hooks/use-business-context";
import { usePagination } from "@/hooks/use-pagination";
import { formatCurrency } from "@/lib/formatting";

export const Route = createFileRoute("/_authenticated/customers/")({
	component: CustomersPage,
});

type SortBy = "lastSeenAt" | "totalOrders" | "totalSpent" | "createdAt";

function CustomersPage() {
	const { activeBusinessId } = useBusinessContext();

	if (!activeBusinessId) {
		return null;
	}

	return <CustomersContent businessId={activeBusinessId} />;
}

interface CustomersContentProps {
	businessId: Id<"businesses">;
}

const ITEMS_PER_PAGE = 10;

function CustomersContent({ businessId }: CustomersContentProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [sortBy, setSortBy] = useState<SortBy>("lastSeenAt");
	const [searchQuery, setSearchQuery] = useState("");
	const [showAddDialog, setShowAddDialog] = useState(false);

	const handleAddSuccess = async (customerId: Id<"customers">) => {
		await queryClient.invalidateQueries();
		setShowAddDialog(false);
		navigate({ to: "/customers/$customerId", params: { customerId } });
	};

	const customersQuery = useQuery(
		convexQuery(api.customers.list, {
			businessId,
			sortBy,
			limit: 100,
		}),
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

	const pagination = usePagination({
		totalItems: filteredCustomers.length,
		itemsPerPage: ITEMS_PER_PAGE,
	});

	const customers = filteredCustomers.slice(pagination.startIndex, pagination.endIndex);

	useEffect(() => {
		pagination.goToFirst();
	}, [searchQuery, sortBy]);

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
		<div className="container mx-auto max-w-7xl px-6 py-8">
			<h1 className="mb-6 font-bold font-heading text-2xl">Customers</h1>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>All Customers</CardTitle>
						<Button size="sm" onClick={() => setShowAddDialog(true)}>
							<Plus className="mr-1 h-4 w-4" />
							Add Customer
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="mb-6">
						<div className="flex flex-col gap-4 md:flex-row md:items-end">
							<div className="flex-1 space-y-2 md:max-w-xs">
								<Label htmlFor="search">Search</Label>
								<div className="relative">
									<Search className="-translate-y-1/2 absolute top-1/2 left-2.5 h-4 w-4 text-muted-foreground" />
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
							<div className="space-y-2 md:w-48">
								<Label htmlFor="sort">Sort By</Label>
								<Select
									value={sortBy}
									onValueChange={(value) => value && setSortBy(value as SortBy)}
								>
									<SelectTrigger className="h-9 w-full">
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
							<h3 className="mb-2 font-semibold text-lg">No customers yet</h3>
							<p className="max-w-[320px] text-muted-foreground text-sm">
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
											className="cursor-pointer transition-colors hover:bg-muted/50"
										>
											<TableCell className="font-medium">{customer.name || "Unknown"}</TableCell>
											<TableCell className="text-muted-foreground">{customer.phone}</TableCell>
											<TableCell className="text-center">{customer.totalOrders}</TableCell>
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

							{pagination.totalPages > 1 && (
								<div className="mt-4 flex items-center justify-between border-t pt-4">
									<p className="text-muted-foreground text-sm">
										Showing {pagination.startIndex + 1}-{pagination.endIndex} of{" "}
										{filteredCustomers.length} customers
									</p>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={pagination.goToPrevious}
											disabled={!pagination.hasPrevious}
										>
											<ChevronLeft className="mr-1 h-4 w-4" />
											Previous
										</Button>
										<span className="px-2 text-muted-foreground text-sm">
											Page {pagination.currentPage} of {pagination.totalPages}
										</span>
										<Button
											variant="outline"
											size="sm"
											onClick={pagination.goToNext}
											disabled={!pagination.hasNext}
										>
											Next
											<ChevronRight className="ml-1 h-4 w-4" />
										</Button>
									</div>
								</div>
							)}
						</>
					)}
				</CardContent>
			</Card>

			<AddCustomerDialog
				open={showAddDialog}
				onOpenChange={setShowAddDialog}
				businessId={businessId}
				onSuccess={handleAddSuccess}
			/>
		</div>
	);
}

interface AddCustomerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	businessId: Id<"businesses">;
	onSuccess: (customerId: Id<"customers">) => void;
}

function AddCustomerDialog({ open, onOpenChange, businessId, onSuccess }: AddCustomerDialogProps) {
	const createCustomer = useMutation(api.customers.create);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [phone, setPhone] = useState("");
	const [name, setName] = useState("");
	const [phoneError, setPhoneError] = useState("");

	const validatePhone = (value: string): boolean => {
		// Basic international phone validation: must start with + and have 8-15 digits
		const phoneRegex = /^\+[1-9]\d{7,14}$/;
		if (!value.trim()) {
			setPhoneError("Phone number is required");
			return false;
		}
		if (!phoneRegex.test(value.trim())) {
			setPhoneError("Enter a valid phone number with country code (e.g., +573001234567)");
			return false;
		}
		setPhoneError("");
		return true;
	};

	const handlePhoneChange = (value: string) => {
		setPhone(value);
		if (phoneError) {
			validatePhone(value);
		}
	};

	const handleSubmit = async () => {
		if (!validatePhone(phone)) return;

		setIsSubmitting(true);
		try {
			const customerId = await createCustomer({
				businessId,
				phone: phone.trim(),
				name: name.trim() || undefined,
			});
			toast.success("Customer added successfully");
			onSuccess(customerId);
			setPhone("");
			setName("");
			setPhoneError("");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to add customer";
			if (message.includes("already exists")) {
				setPhoneError("A customer with this phone number already exists");
			} else {
				toast.error(message);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = () => {
		onOpenChange(false);
		setPhone("");
		setName("");
		setPhoneError("");
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Add Customer</DialogTitle>
					<DialogDescription>
						Add a new customer to your business. They'll appear in your customer list immediately.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="phone">
							Phone Number <span className="text-destructive">*</span>
						</Label>
						<Input
							id="phone"
							type="tel"
							value={phone}
							onChange={(e) => handlePhoneChange(e.target.value)}
							placeholder="+573001234567"
							className={phoneError ? "border-destructive" : ""}
						/>
						{phoneError && <p className="text-destructive text-sm">{phoneError}</p>}
						<p className="text-muted-foreground text-xs">
							Include country code (e.g., +57 for Colombia, +55 for Brazil)
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Customer name (optional)"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting || !phone.trim()}>
						{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Add Customer
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
