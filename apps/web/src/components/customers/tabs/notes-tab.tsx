import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@echo/backend/convex/_generated/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { Loader2, Lock, MoreVertical, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";

export interface NotesTabProps {
	customerId: Id<"customers">;
	formatDate: (timestamp: number) => string;
}

export function NotesTab({ customerId, formatDate }: NotesTabProps) {
	const queryClient = useQueryClient();
	const notesQuery = useQuery(convexQuery(api.customerNotes.list, { customerId }));
	const addNote = useMutation(api.customerNotes.add);
	const updateNote = useMutation(api.customerNotes.update);
	const deleteNote = useMutation(api.customerNotes.deleteNote);

	const [showAddDialog, setShowAddDialog] = useState(false);
	const [editingNote, setEditingNote] = useState<{
		_id: Id<"customerNotes">;
		note: string;
		staffOnly: boolean;
	} | null>(null);
	const [deletingNoteId, setDeletingNoteId] = useState<Id<"customerNotes"> | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [noteText, setNoteText] = useState("");
	const [staffOnly, setStaffOnly] = useState(false);

	const notes = notesQuery.data ?? [];

	const handleAdd = async () => {
		if (!noteText.trim()) return;
		setIsSubmitting(true);
		try {
			await addNote({ customerId, note: noteText.trim(), staffOnly });
			toast.success("Note added");
			await queryClient.invalidateQueries();
			setShowAddDialog(false);
			setNoteText("");
			setStaffOnly(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to add note");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdate = async () => {
		if (!editingNote || !noteText.trim()) return;
		setIsSubmitting(true);
		try {
			await updateNote({ noteId: editingNote._id, note: noteText.trim(), staffOnly });
			toast.success("Note updated");
			await queryClient.invalidateQueries();
			setEditingNote(null);
			setNoteText("");
			setStaffOnly(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update note");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!deletingNoteId) return;
		setIsSubmitting(true);
		try {
			await deleteNote({ noteId: deletingNoteId });
			toast.success("Note deleted");
			await queryClient.invalidateQueries();
			setDeletingNoteId(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete note");
		} finally {
			setIsSubmitting(false);
		}
	};

	const openEditDialog = (n: { _id: Id<"customerNotes">; note: string; staffOnly: boolean }) => {
		setEditingNote(n);
		setNoteText(n.note);
		setStaffOnly(n.staffOnly);
	};

	const closeDialogs = () => {
		setShowAddDialog(false);
		setEditingNote(null);
		setNoteText("");
		setStaffOnly(false);
	};

	if (notesQuery.isLoading) {
		return <div className="py-8 text-center text-muted-foreground">Loading notes...</div>;
	}

	return (
		<>
			<div className="mb-4 flex justify-end">
				<Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
					<Plus className="mr-1 h-4 w-4" />
					Add Note
				</Button>
			</div>

			{notes.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<StickyNote className="mb-4 h-10 w-10 text-muted-foreground" />
						<h3 className="mb-2 font-semibold text-lg">No notes yet</h3>
						<p className="text-muted-foreground text-sm">
							Add notes about this customer for your team
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{notes.map((note) => (
						<Card key={note._id} className="group">
							<CardContent className="py-4">
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1">
										<p className="whitespace-pre-wrap text-sm">{note.note}</p>
										{note.staffOnly && (
											<div className="mt-2 flex items-center gap-1 text-muted-foreground">
												<Lock className="h-3 w-3" />
												<span className="text-xs">Staff Only</span>
											</div>
										)}
									</div>
									<div className="flex items-start gap-2">
										<div className="whitespace-nowrap text-right text-muted-foreground text-sm">
											{formatDate(note.createdAt)}
										</div>
										<DropdownMenu>
											<DropdownMenuTrigger className="flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
												<MoreVertical className="h-3 w-3" />
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => openEditDialog(note)}>
													<Pencil className="mr-2 h-4 w-4" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => setDeletingNoteId(note._id)}
												>
													<Trash2 className="mr-2 h-4 w-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
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
						<DialogTitle>Add Note</DialogTitle>
						<DialogDescription>Add a note about this customer</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="add-note">Note</Label>
							<textarea
								id="add-note"
								value={noteText}
								onChange={(e) => setNoteText(e.target.value)}
								placeholder="Enter note..."
								className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							/>
						</div>
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								id="add-staff-only"
								checked={staffOnly}
								onChange={(e) => setStaffOnly(e.target.checked)}
								className="h-4 w-4 rounded border-input"
							/>
							<Label
								htmlFor="add-staff-only"
								className="flex items-center gap-1 font-normal text-sm"
							>
								<Lock className="h-3 w-3" />
								Staff only (not shared with AI)
							</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeDialogs} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button onClick={handleAdd} disabled={isSubmitting || !noteText.trim()}>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Add Note
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!editingNote}
				onOpenChange={(open) => {
					if (!open) closeDialogs();
				}}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Edit Note</DialogTitle>
						<DialogDescription>Update note information</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="edit-note">Note</Label>
							<textarea
								id="edit-note"
								value={noteText}
								onChange={(e) => setNoteText(e.target.value)}
								placeholder="Enter note..."
								className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							/>
						</div>
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								id="edit-staff-only"
								checked={staffOnly}
								onChange={(e) => setStaffOnly(e.target.checked)}
								className="h-4 w-4 rounded border-input"
							/>
							<Label
								htmlFor="edit-staff-only"
								className="flex items-center gap-1 font-normal text-sm"
							>
								<Lock className="h-3 w-3" />
								Staff only (not shared with AI)
							</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeDialogs} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button onClick={handleUpdate} disabled={isSubmitting || !noteText.trim()}>
							{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!deletingNoteId}
				onOpenChange={(open) => {
					if (!open) setDeletingNoteId(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Note</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this note? This action cannot be undone.
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
