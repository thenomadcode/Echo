import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	ArrowLeft,
	Heart,
	Loader2,
	MessageCircle,
	Pencil,
	Phone,
	ShoppingBag,
	StickyNote,
	Trash2,
	User,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EditCustomerDialog } from "@/components/customers/dialogs/edit-customer-dialog";
import { ConversationsTab } from "@/components/customers/tabs/conversations-tab";
import { NotesTab } from "@/components/customers/tabs/notes-tab";
import { OrdersTab } from "@/components/customers/tabs/orders-tab";
import { OverviewTab } from "@/components/customers/tabs/overview-tab";
import { PreferencesTab } from "@/components/customers/tabs/preferences-tab";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
	component: CustomerDetailPage,
});

type TabId = "overview" | "orders" | "conversations" | "preferences" | "notes";

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
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const customerQuery = useQuery(
		convexQuery(api.customers.get, { customerId: customerId as Id<"customers"> }),
	);

	const contextQuery = useQuery(
		convexQuery(api.customers.getContext, { customerId: customerId as Id<"customers"> }),
	);

	const customer = customerQuery.data;
	const context = contextQuery.data;

	const deleteCustomer = useMutation(api.customers.deleteCustomer);

	const handleEditSuccess = async () => {
		await queryClient.invalidateQueries();
		setShowEditDialog(false);
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteCustomer({ customerId: customerId as Id<"customers"> });
			toast.success("Customer deleted successfully");
			navigate({ to: "/customers" });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete customer");
		} finally {
			setIsDeleting(false);
			setShowDeleteDialog(false);
		}
	};

	if (customerQuery.isLoading) {
		return (
			<div className="container mx-auto max-w-5xl px-6 py-8">
				<div className="flex min-h-[400px] items-center justify-center">
					<div className="text-muted-foreground">Loading...</div>
				</div>
			</div>
		);
	}

	if (!customer) {
		return (
			<div className="container mx-auto max-w-5xl px-6 py-8">
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
						<h3 className="mb-2 font-semibold text-lg">Customer not found</h3>
						<p className="text-muted-foreground text-sm">
							The customer you're looking for doesn't exist or you don't have access.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-5xl px-6 py-8">
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
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted font-semibold text-2xl">
							{customer.name?.[0]?.toUpperCase() || customer.phone[0]}
						</div>
						<div>
							<div className="flex items-center gap-3">
								<h1 className="font-bold font-heading text-2xl">
									{customer.name || "Unknown Customer"}
								</h1>
							</div>
							<div className="mt-1 flex items-center gap-2 text-muted-foreground">
								<Phone className="h-4 w-4" />
								<span>{customer.phone}</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-6">
						<div className="flex gap-6 text-center">
							<div>
								<p className="font-bold text-2xl">{customer.totalOrders}</p>
								<p className="text-muted-foreground text-sm">Orders</p>
							</div>
							<div>
								<p className="font-bold text-2xl">{formatCurrency(customer.totalSpent)}</p>
								<p className="text-muted-foreground text-sm">Lifetime Spend</p>
							</div>
						</div>
						<Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</Button>
						<Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</Button>
					</div>
				</div>
			</div>

			<div className="mb-6 border-b">
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
									"-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 py-3 font-medium text-sm transition-colors",
									activeTab === tab.id
										? "border-primary text-primary"
										: "border-transparent text-muted-foreground hover:text-foreground",
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
				<OverviewTab
					customer={customer}
					context={context}
					formatCurrency={formatCurrency}
					formatDate={formatDate}
				/>
			)}
			{activeTab === "orders" && (
				<OrdersTab
					customerId={customerId as Id<"customers">}
					formatCurrency={formatCurrency}
					formatDate={formatDate}
					navigate={navigate}
				/>
			)}
			{activeTab === "conversations" && (
				<ConversationsTab
					customerId={customerId as Id<"customers">}
					formatDate={formatDate}
					navigate={navigate}
				/>
			)}
			{activeTab === "preferences" && <PreferencesTab customerId={customerId as Id<"customers">} />}
			{activeTab === "notes" && (
				<NotesTab customerId={customerId as Id<"customers">} formatDate={formatDate} />
			)}

			<EditCustomerDialog
				open={showEditDialog}
				onOpenChange={setShowEditDialog}
				customer={customer}
				onSuccess={handleEditSuccess}
			/>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Customer</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete {customer.name || customer.phone}? This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-3">
						<div className="rounded-md bg-destructive/10 p-3 text-sm">
							<p className="mb-2 font-medium text-destructive">
								The following data will be permanently deleted:
							</p>
							<ul className="list-inside list-disc space-y-1 text-muted-foreground">
								<li>Customer profile and contact information</li>
								<li>All saved addresses</li>
								<li>Preferences, allergies, and restrictions</li>
								<li>Staff notes</li>
								<li>Conversation summaries</li>
							</ul>
						</div>
						<p className="text-muted-foreground text-sm">
							Order history will be retained but anonymized (customer reference removed).
						</p>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete Customer
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
