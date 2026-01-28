import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Loader2, MapPin, MoreVertical, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AddressesSectionProps {
	customerId: Id<"customers">;
}

export function AddressesSection({ customerId }: AddressesSectionProps) {
	const queryClient = useQueryClient();
	const addressesQuery = useQuery(convexQuery(api.customerAddresses.list, { customerId }));
	const addAddress = useMutation(api.customerAddresses.add);
	const updateAddress = useMutation(api.customerAddresses.update);
	const deleteAddress = useMutation(api.customerAddresses.deleteAddress);
	const setDefaultAddress = useMutation(api.customerAddresses.setDefault);

	const [showAddDialog, setShowAddDialog] = useState(false);
	const [editingAddress, setEditingAddress] = useState<{
		_id: Id<"customerAddresses">;
		label: string;
		address: string;
	} | null>(null);
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
			await updateAddress({
				addressId: editingAddress._id,
				label: label.trim(),
				address: address.trim(),
			});
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

	const openEditDialog = (addr: {
		_id: Id<"customerAddresses">;
		label: string;
		address: string;
	}) => {
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
						<CardTitle className="flex items-center gap-2 text-base">
							<MapPin className="h-4 w-4" />
							Saved Addresses
						</CardTitle>
						<Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
							<Plus className="mr-1 h-4 w-4" />
							Add
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{addresses.length > 0 ? (
						<div className="space-y-3">
							{addresses.map((addr) => (
								<div key={addr._id} className="group flex items-start gap-2">
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<span className="font-medium text-sm">{addr.label}</span>
											{addr.isDefault && (
												<Badge variant="secondary" className="text-xs">
													Default
												</Badge>
											)}
										</div>
										<p className="text-muted-foreground text-sm">{addr.address}</p>
									</div>
									<DropdownMenu>
										<DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md p-0 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
											<MoreVertical className="h-4 w-4" />
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onClick={() => openEditDialog(addr)}>
												<Pencil className="mr-2 h-4 w-4" />
												Edit
											</DropdownMenuItem>
											{!addr.isDefault && (
												<DropdownMenuItem onClick={() => handleSetDefault(addr._id)}>
													<Star className="mr-2 h-4 w-4" />
													Set as Default
												</DropdownMenuItem>
											)}
											<DropdownMenuItem
												className="text-destructive focus:text-destructive"
												onClick={() => setDeletingAddressId(addr._id)}
											>
												<Trash2 className="mr-2 h-4 w-4" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">No saved addresses</p>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={showAddDialog}
				onOpenChange={(open) => {
					if (!open) closeDialogs();
					else setShowAddDialog(true);
				}}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Add Address</DialogTitle>
						<DialogDescription>Add a new address for this customer</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="add-label">Label</Label>
							<Input
								id="add-label"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder="e.g., Home, Work"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="add-address">Address</Label>
							<Input
								id="add-address"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								placeholder="Full address"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeDialogs} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button onClick={handleAdd} disabled={isSubmitting || !label.trim() || !address.trim()}>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Add Address
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!editingAddress}
				onOpenChange={(open) => {
					if (!open) closeDialogs();
				}}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Edit Address</DialogTitle>
						<DialogDescription>Update address information</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-label">Label</Label>
							<Input
								id="edit-label"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder="e.g., Home, Work"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="edit-address">Address</Label>
							<Input
								id="edit-address"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								placeholder="Full address"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeDialogs} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button
							onClick={handleUpdate}
							disabled={isSubmitting || !label.trim() || !address.trim()}
						>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!deletingAddressId}
				onOpenChange={(open) => {
					if (!open) setDeletingAddressId(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Address</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this address? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isSubmitting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
