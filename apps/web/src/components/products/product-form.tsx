import type { VariantOption } from "@/components/products/variant-options-builder";
import { VariantOptionsBuilder } from "@/components/products/variant-options-builder";
import type { GeneratedVariant } from "@/components/products/variant-table-editor";
import { VariantTableEditor } from "@/components/products/variant-table-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PriceInput } from "@/components/ui/price-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

interface ProductFormProps {
	businessId: string;
	mode: "create" | "edit";
	productId?: Id<"products">;
	initialData?: {
		name: string;
		description?: string;
		price: number;
		categoryId?: string;
		imageId?: string;
	};
	onSuccess?: () => void;
}

export function ProductForm({
	businessId,
	mode,
	productId,
	initialData,
	onSuccess,
}: ProductFormProps) {
	const categories = useQuery(api.categories.list, { businessId });
	const createProduct = useMutation(api.products.create);
	const updateProduct = useMutation(api.products.update);
	const createCategory = useMutation(api.categories.create);

	const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");

	const business = useQuery(
		api.businesses.get,
		businessId ? { businessId: businessId as Id<"businesses"> } : "skip",
	);

	const productSchema = z.object({
		name: z.string().min(1, "Product name is required"),
		description: z.string(),
		price: z.number().min(1, "Price must be greater than 0"),
		categoryId: z.string(),
		imageId: z.string(),
		hasVariants: z.boolean(),
		variantOptions: z.array(
			z.object({
				name: z.string(),
				values: z.array(z.string()),
			}),
		),
		generatedVariants: z.array(
			z.object({
				name: z.string(),
				sku: z.string(),
				price: z.number(),
				inventoryQuantity: z.number(),
				imageId: z.string(),
				available: z.boolean(),
				option1Name: z.string().optional(),
				option1Value: z.string().optional(),
				option2Name: z.string().optional(),
				option2Value: z.string().optional(),
				option3Name: z.string().optional(),
				option3Value: z.string().optional(),
			}),
		),
	});

	const form = useForm({
		defaultValues: {
			name: initialData?.name || "",
			description: initialData?.description || "",
			price: initialData?.price || 0,
			categoryId: initialData?.categoryId || "",
			imageId: initialData?.imageId || "",
			hasVariants: false,
			variantOptions: [] as VariantOption[],
			generatedVariants: [] as GeneratedVariant[],
		},
		onSubmit: async ({ value }) => {
			try {
				const validated = productSchema.safeParse(value);

				if (!validated.success) {
					const firstError = validated.error.issues[0];
					toast.error(firstError.message);
					return;
				}

				if (mode === "create") {
					await createProduct({
						businessId,
						name: validated.data.name,
						description: validated.data.description || undefined,
						price: validated.data.price,
						categoryId: validated.data.categoryId || undefined,
						imageId: validated.data.imageId || undefined,
					});
					toast.success("Product created successfully");
				} else {
					if (!productId) {
						toast.error("Product ID is required for edit mode");
						return;
					}
					await updateProduct({
						productId,
						name: validated.data.name,
						description: validated.data.description || undefined,
						price: validated.data.price,
						categoryId: validated.data.categoryId || undefined,
						imageId: validated.data.imageId || undefined,
					});
					toast.success("Product updated successfully");
				}

				if (onSuccess) {
					onSuccess();
				}
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to save product");
			}
		},
	});

	const currency =
		business?.defaultLanguage === "es" ? "COP" : business?.defaultLanguage === "pt" ? "BRL" : "USD";

	if (categories === undefined || business === undefined) {
		return (
			<div className="flex items-center justify-center py-8">
				<div>Loading...</div>
			</div>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{mode === "create" ? "Create Product" : "Edit Product"}</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-6"
				>
					<form.Field name="name">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>
									Product Name <span className="text-red-500">*</span>
								</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="Product name"
								/>
								{field.state.meta.errors.length > 0 &&
									field.state.meta.errors.map((error, i) => (
										<p key={i} className="text-red-500 text-sm">
											{String(error)}
										</p>
									))}
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
									placeholder="Product description (optional)"
									className="min-h-[100px]"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="price">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>
									Price <span className="text-red-500">*</span>
								</Label>
								<PriceInput
									id={field.name}
									name={field.name}
									currency={currency}
									value={field.state.value}
									onChange={(valueInCents) => field.handleChange(valueInCents)}
									placeholder="0.00"
								/>
								{field.state.meta.errors.length > 0 &&
									field.state.meta.errors.map((error, i) => (
										<p key={i} className="text-red-500 text-sm">
											{String(error)}
										</p>
									))}
							</div>
						)}
					</form.Field>

					<form.Field name="categoryId">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Category</Label>
								<div className="flex gap-2">
									<Select
										value={field.state.value || undefined}
										onValueChange={(value) => field.handleChange(value ?? "")}
									>
										<SelectTrigger className="h-10 w-full">
											<SelectValue placeholder="Select a category (optional)" />
										</SelectTrigger>
										<SelectContent>
											{categories.map((category) => (
												<SelectItem key={category._id} value={category._id}>
													{category.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Dialog open={isCreateCategoryOpen} onOpenChange={setIsCreateCategoryOpen}>
										<DialogTrigger
											render={
												<Button
													type="button"
													variant="outline"
													size="icon"
													className="h-10 w-10 shrink-0"
												/>
											}
										>
											<Plus className="h-4 w-4" />
										</DialogTrigger>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>Create Category</DialogTitle>
											</DialogHeader>
											<div className="space-y-2">
												<Label htmlFor="new-category-name">Category Name</Label>
												<Input
													id="new-category-name"
													value={newCategoryName}
													onChange={(e) => setNewCategoryName(e.target.value)}
													placeholder="Enter category name"
												/>
											</div>
											<DialogFooter>
												<Button
													type="button"
													variant="outline"
													onClick={() => {
														setNewCategoryName("");
														setIsCreateCategoryOpen(false);
													}}
												>
													Cancel
												</Button>
												<Button
													type="button"
													onClick={async () => {
														const trimmedName = newCategoryName.trim();
														if (!trimmedName) {
															toast.error("Category name is required");
															return;
														}
														try {
															const newCategoryId = await createCategory({
																businessId,
																name: trimmedName,
																order: categories?.length ?? 0,
															});
															field.handleChange(newCategoryId);
															toast.success("Category created");
															setNewCategoryName("");
															setIsCreateCategoryOpen(false);
														} catch (error) {
															toast.error(
																error instanceof Error
																	? error.message
																	: "Failed to create category",
															);
														}
													}}
												>
													Create
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								</div>
							</div>
						)}
					</form.Field>

					<form.Field name="imageId">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Product Image</Label>
								<ImageUpload
									value={field.state.value}
									onChange={(storageId) => field.handleChange(storageId || "")}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="hasVariants">
						{(field) => (
							<div className="flex items-center justify-between rounded-lg border p-4">
								<div className="space-y-0.5">
									<Label htmlFor={field.name} className="text-base">
										This product has variants
									</Label>
									<div className="text-muted-foreground text-sm">
										Enable this if your product comes in different sizes, colors, or other
										variations
									</div>
								</div>
								<Switch
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked) => field.handleChange(checked)}
								/>
							</div>
						)}
					</form.Field>

					<form.Subscribe selector={(state) => state.values.hasVariants}>
						{(hasVariants) =>
							hasVariants ? (
								<div key="variant-options" className="space-y-6">
									<form.Field name="variantOptions">
										{(optionsField) => (
											<form.Field name="generatedVariants">
												{(variantsField) => (
													<VariantOptionsBuilder
														field={optionsField}
														onGenerate={(variants) => variantsField.handleChange(variants)}
													/>
												)}
											</form.Field>
										)}
									</form.Field>
									<form.Field name="generatedVariants">
										{(field) => <VariantTableEditor field={field} currency={currency} />}
									</form.Field>
								</div>
							) : null
						}
					</form.Subscribe>

					<div className="flex gap-2">
						<Button type="submit" className="flex-1">
							{mode === "create" ? "Create Product" : "Save Changes"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
