import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Heart, Loader2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PreferencesTabProps {
	customerId: Id<"customers">;
}

type MemoryCategory = "allergy" | "restriction" | "preference" | "behavior" | "complaint";

const CATEGORY_CONFIG: Record<MemoryCategory, { label: string; color: string; bgColor: string }> = {
	allergy: {
		label: "Allergies",
		color: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-50 dark:bg-red-950/30",
	},
	restriction: {
		label: "Restrictions",
		color: "text-orange-600 dark:text-orange-400",
		bgColor: "bg-orange-50 dark:bg-orange-950/30",
	},
	preference: {
		label: "Preferences",
		color: "text-blue-600 dark:text-blue-400",
		bgColor: "bg-blue-50 dark:bg-blue-950/30",
	},
	behavior: {
		label: "Behaviors",
		color: "text-gray-600 dark:text-gray-400",
		bgColor: "bg-gray-50 dark:bg-gray-950/30",
	},
	complaint: {
		label: "Complaints",
		color: "text-purple-600 dark:text-purple-400",
		bgColor: "bg-purple-50 dark:bg-purple-950/30",
	},
};

export function PreferencesTab({ customerId }: PreferencesTabProps) {
	const queryClient = useQueryClient();
	const memoriesQuery = useQuery(convexQuery(api.customerMemory.list, { customerId }));
	const addMemory = useMutation(api.customerMemory.add);
	const updateMemory = useMutation(api.customerMemory.update);
	const deleteMemory = useMutation(api.customerMemory.deleteMemory);

	const [showAddDialog, setShowAddDialog] = useState(false);
	const [editingMemory, setEditingMemory] = useState<{
		_id: Id<"customerMemory">;
		fact: string;
		category: MemoryCategory;
	} | null>(null);
	const [deletingMemory, setDeletingMemory] = useState<{
		_id: Id<"customerMemory">;
		category: MemoryCategory;
	} | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [category, setCategory] = useState<MemoryCategory>("preference");
	const [fact, setFact] = useState("");

	const memories = memoriesQuery.data ?? [];
	const groupedMemories = memories.reduce(
		(acc, mem) => {
			const cat = mem.category as MemoryCategory;
			if (!acc[cat]) acc[cat] = [];
			acc[cat].push(mem);
			return acc;
		},
		{} as Record<MemoryCategory, typeof memories>,
	);

	const handleAdd = async () => {
		if (!fact.trim()) return;
		setIsSubmitting(true);
		try {
			await addMemory({ customerId, category, fact: fact.trim(), source: "manual" });
			toast.success("Preference added");
			await queryClient.invalidateQueries();
			setShowAddDialog(false);
			setFact("");
			setCategory("preference");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to add preference");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdate = async () => {
		if (!editingMemory || !fact.trim()) return;
		setIsSubmitting(true);
		try {
			await updateMemory({ memoryId: editingMemory._id, fact: fact.trim() });
			toast.success("Preference updated");
			await queryClient.invalidateQueries();
			setEditingMemory(null);
			setFact("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update preference");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!deletingMemory) return;
		setIsSubmitting(true);
		try {
			const isAllergy = deletingMemory.category === "allergy";
			await deleteMemory({ memoryId: deletingMemory._id, confirmAllergyDeletion: isAllergy });
			toast.success("Preference deleted");
			await queryClient.invalidateQueries();
			setDeletingMemory(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete preference");
		} finally {
			setIsSubmitting(false);
		}
	};

	const openEditDialog = (mem: { _id: Id<"customerMemory">; fact: string; category: string }) => {
		setEditingMemory({ _id: mem._id, fact: mem.fact, category: mem.category as MemoryCategory });
		setFact(mem.fact);
	};

	const closeDialogs = () => {
		setShowAddDialog(false);
		setEditingMemory(null);
		setFact("");
		setCategory("preference");
	};

	if (memoriesQuery.isLoading) {
		return <div className="py-8 text-center text-muted-foreground">Loading preferences...</div>;
	}

	const hasAny = memories.length > 0;

	return (
		<>
			<div className="mb-4 flex justify-end">
				<Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
					<Plus className="mr-1 h-4 w-4" />
					Add Preference
				</Button>
			</div>

			{!hasAny ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Heart className="mb-4 h-10 w-10 text-muted-foreground" />
						<h3 className="mb-2 font-semibold text-lg">No preferences recorded</h3>
						<p className="text-muted-foreground text-sm">
							Add preferences manually or they'll be extracted from conversations automatically
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{(Object.keys(CATEGORY_CONFIG) as MemoryCategory[]).map((cat) => {
						const items = groupedMemories[cat] ?? [];
						if (items.length === 0) return null;
						const config = CATEGORY_CONFIG[cat];
						return (
							<Card
								key={cat}
								className={cat === "allergy" ? "border-red-200 dark:border-red-900" : ""}
							>
								<CardHeader>
									<CardTitle className={cn("text-base", config.color)}>{config.label}</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="space-y-2">
										{items.map((mem) => (
											<div
												key={mem._id}
												className={cn(
													"group flex items-start justify-between gap-2 rounded-md px-3 py-2 text-sm",
													config.bgColor,
												)}
											>
												<div className="flex-1">
													<span>{mem.fact}</span>
													<div className="mt-1 flex items-center gap-2">
														<Badge variant="secondary" className="text-xs">
															{mem.source === "ai_extracted"
																? "AI"
																: mem.source === "manual"
																	? "Manual"
																	: "Order"}
														</Badge>
														{mem.source === "ai_extracted" && mem.confidence && (
															<span className="text-muted-foreground text-xs">
																{Math.round(mem.confidence * 100)}% confidence
															</span>
														)}
													</div>
												</div>
												<DropdownMenu>
													<DropdownMenuTrigger className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-background/50 group-hover:opacity-100">
														<MoreVertical className="h-3 w-3" />
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem onClick={() => openEditDialog(mem)}>
															<Pencil className="mr-2 h-4 w-4" />
															Edit
														</DropdownMenuItem>
														<DropdownMenuItem
															className="text-destructive focus:text-destructive"
															onClick={() =>
																setDeletingMemory({
																	_id: mem._id,
																	category: mem.category as MemoryCategory,
																})
															}
														>
															<Trash2 className="mr-2 h-4 w-4" />
															Delete
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			<Dialog
				open={showAddDialog}
				onOpenChange={(open) => {
					if (!open) closeDialogs();
					else setShowAddDialog(true);
				}}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Add Preference</DialogTitle>
						<DialogDescription>Add a new preference or fact about this customer</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="add-category">Category</Label>
							<Select value={category} onValueChange={(v) => v && setCategory(v as MemoryCategory)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="allergy">Allergy</SelectItem>
									<SelectItem value="restriction">Restriction</SelectItem>
									<SelectItem value="preference">Preference</SelectItem>
									<SelectItem value="behavior">Behavior</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="add-fact">Fact</Label>
							<Input
								id="add-fact"
								value={fact}
								onChange={(e) => setFact(e.target.value)}
								placeholder="e.g., No onions, Extra spicy"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeDialogs} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button onClick={handleAdd} disabled={isSubmitting || !fact.trim()}>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Add
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!editingMemory}
				onOpenChange={(open) => {
					if (!open) closeDialogs();
				}}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Edit Preference</DialogTitle>
						<DialogDescription>Update preference information</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-fact">Fact</Label>
							<Input
								id="edit-fact"
								value={fact}
								onChange={(e) => setFact(e.target.value)}
								placeholder="e.g., No onions, Extra spicy"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeDialogs} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button onClick={handleUpdate} disabled={isSubmitting || !fact.trim()}>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!deletingMemory}
				onOpenChange={(open) => {
					if (!open) setDeletingMemory(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{deletingMemory?.category === "allergy"
								? "Delete Allergy Information"
								: "Delete Preference"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{deletingMemory?.category === "allergy" ? (
								<>
									<span className="font-semibold text-destructive">
										WARNING: You are about to delete allergy information.
									</span>
									<br />
									This is safety-critical data. Deleting it may put the customer at risk. Are you
									absolutely sure?
								</>
							) : (
								"Are you sure you want to delete this preference? This action cannot be undone."
							)}
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
