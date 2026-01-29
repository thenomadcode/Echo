import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CategoryManagerProps {
	businessId: string;
}

export function CategoryManager({ businessId }: CategoryManagerProps) {
	const categories = useQuery(api.categories.list, { businessId });
	const products = useQuery(api.products.list, { businessId });
	const createCategory = useMutation(api.categories.create);
	const updateCategory = useMutation(api.categories.update);
	const deleteCategory = useMutation(api.categories.deleteCategory);

	const [newCategoryName, setNewCategoryName] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

	const handleCreateCategory = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newCategoryName.trim()) {
			toast.error("Category name is required");
			return;
		}

		try {
			const order = categories ? categories.length : 0;
			await createCategory({
				businessId,
				name: newCategoryName.trim(),
				order,
			});
			toast.success("Category created successfully");
			setNewCategoryName("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create category");
		}
	};

	const handleEditCategory = async (categoryId: string) => {
		if (!editName.trim()) {
			toast.error("Category name is required");
			return;
		}

		try {
			await updateCategory({
				categoryId: categoryId as Id<"categories">,
				name: editName.trim(),
			});
			toast.success("Category updated successfully");
			setEditingId(null);
			setEditName("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update category");
		}
	};

	const handleDeleteCategory = async (categoryId: string) => {
		try {
			await deleteCategory({
				categoryId: categoryId as Id<"categories">,
			});
			toast.success("Category deleted successfully");
			setDeleteConfirmId(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to delete category");
		}
	};

	const startEditing = (categoryId: string, currentName: string) => {
		setEditingId(categoryId);
		setEditName(currentName);
	};

	const cancelEditing = () => {
		setEditingId(null);
		setEditName("");
	};

	const getCategoryProductCount = (categoryId: string) => {
		if (!products?.products) return 0;
		return products.products.filter((p) => p.categoryId === categoryId).length;
	};

	const getUncategorizedCount = () => {
		if (!products?.products) return 0;
		return products.products.filter((p) => !p.categoryId).length;
	};

	if (categories === undefined || products === undefined) {
		return (
			<div className="flex items-center justify-center py-8">
				<div>Loading categories...</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Create New Category</CardTitle>
					<CardDescription>Add a new product category</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleCreateCategory} className="flex gap-2">
						<div className="flex-1">
							<Label htmlFor="newCategoryName" className="sr-only">
								Category Name
							</Label>
							<Input
								id="newCategoryName"
								placeholder="Category name"
								value={newCategoryName}
								onChange={(e) => setNewCategoryName(e.target.value)}
							/>
						</div>
						<Button type="submit">Create Category</Button>
					</form>
				</CardContent>
			</Card>

			{categories.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<p className="text-muted-foreground">No categories yet</p>
						<p className="mt-2 text-muted-foreground text-sm">
							Create your first category using the form above
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Categories</CardTitle>
						<CardDescription>Manage your product categories</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{categories.map((category) => (
								<div
									key={category._id}
									className="flex items-center justify-between rounded-md border p-3"
								>
									{editingId === category._id ? (
										<div className="flex flex-1 items-center gap-2">
											<Input
												value={editName}
												onChange={(e) => setEditName(e.target.value)}
												className="flex-1"
											/>
											<Button size="sm" onClick={() => handleEditCategory(category._id)}>
												Save
											</Button>
											<Button size="sm" variant="outline" onClick={cancelEditing}>
												Cancel
											</Button>
										</div>
									) : (
										<>
											<div className="flex-1">
												<p className="font-medium">{category.name}</p>
												<p className="text-muted-foreground text-sm">
													{getCategoryProductCount(category._id)} products
												</p>
											</div>
											<div className="flex items-center gap-2">
												<Button
													size="sm"
													variant="ghost"
													onClick={() => startEditing(category._id, category.name)}
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => setDeleteConfirmId(category._id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</>
									)}
								</div>
							))}

							{getUncategorizedCount() > 0 && (
								<div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
									<div className="flex-1">
										<p className="font-medium">Uncategorized</p>
										<p className="text-muted-foreground text-sm">
											{getUncategorizedCount()} products
										</p>
									</div>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{deleteConfirmId && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<Card className="mx-4 w-full max-w-md">
						<CardHeader>
							<CardTitle>Delete Category?</CardTitle>
							<CardDescription>
								This action cannot be undone. Products in this category will become uncategorized.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
								Cancel
							</Button>
							<Button variant="destructive" onClick={() => handleDeleteCategory(deleteConfirmId)}>
								Delete
							</Button>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
