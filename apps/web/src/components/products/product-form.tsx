import { api } from "@echo/backend/convex/_generated/api";
import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface VariantOption {
	name: string;
	values: string[];
}

interface VariantData {
	id: string;
	name: string;
	sku: string;
	price: number;
	inventoryQuantity: number;
	imageId: string;
	option1Name?: string;
	option1Value?: string;
	option2Name?: string;
	option2Value?: string;
	option3Name?: string;
	option3Value?: string;
	deleted: boolean;
}

function generateVariantCombinations(options: VariantOption[]): VariantData[] {
	const validOptions = options.filter((opt) => opt.name.trim() && opt.values.length > 0);

	if (validOptions.length === 0) {
		return [];
	}

	const cartesian = (arrays: string[][]): string[][] => {
		if (arrays.length === 0) return [[]];
		const [first, ...rest] = arrays;
		const restCombinations = cartesian(rest);
		const result: string[][] = [];
		for (const val of first) {
			for (const combo of restCombinations) {
				result.push([val, ...combo]);
			}
		}
		return result;
	};

	const valueArrays = validOptions.map((opt) => opt.values);
	const combinations = cartesian(valueArrays);

	return combinations.map((combo, index) => {
		const variant: VariantData = {
			id: `variant-${Date.now()}-${index}`,
			name: combo.join(" / "),
			sku: "",
			price: 0,
			inventoryQuantity: 0,
			imageId: "",
			deleted: false,
		};

		validOptions.forEach((opt, optIndex) => {
			const optNum = optIndex + 1;
			if (optNum === 1) {
				variant.option1Name = opt.name;
				variant.option1Value = combo[optIndex];
			} else if (optNum === 2) {
				variant.option2Name = opt.name;
				variant.option2Value = combo[optIndex];
			} else if (optNum === 3) {
				variant.option3Name = opt.name;
				variant.option3Value = combo[optIndex];
			}
		});

		return variant;
	});
}

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
		hasVariants?: boolean;
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
	const createVariant = useMutation(api.variants.create);

	const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");

	const [variantOptions, setVariantOptions] = useState<VariantOption[]>([{ name: "", values: [] }]);
	const [variants, setVariants] = useState<VariantData[]>([]);
	const [optionInputValues, setOptionInputValues] = useState<string[]>([""]);

	const business = useQuery(
		api.businesses.get,
		businessId ? { businessId: businessId as Id<"businesses"> } : "skip",
	);

	const form = useForm({
		defaultValues: {
			name: initialData?.name || "",
			description: initialData?.description || "",
			price: initialData?.price || 0,
			categoryId: initialData?.categoryId || "",
			imageId: initialData?.imageId || "",
			hasVariants: initialData?.hasVariants ?? false,
		},
		onSubmit: async ({ value }) => {
			try {
				const productSchema = z.object({
					name: z.string().min(1, "Product name is required"),
					description: z.string(),
					price: value.hasVariants ? z.number() : z.number().min(1, "Price must be greater than 0"),
					categoryId: z.string(),
					imageId: z.string(),
					hasVariants: z.boolean(),
				});

				const validated = productSchema.safeParse(value);

				if (!validated.success) {
					const firstError = validated.error.issues[0];
					toast.error(firstError.message);
					return;
				}

				if (validated.data.hasVariants) {
					const activeVariants = variants.filter((v) => !v.deleted);
					if (activeVariants.length === 0) {
						toast.error("At least one variant is required for products with variants");
						return;
					}

					const hasInvalidPrices = activeVariants.some((v) => v.price <= 0);
					if (hasInvalidPrices) {
						toast.error("All variants must have a price greater than 0");
						return;
					}
				}

				if (mode === "create") {
					const newProductId = await createProduct({
						businessId,
						name: validated.data.name,
						description: validated.data.description || undefined,
						price: validated.data.hasVariants ? undefined : validated.data.price,
						categoryId: validated.data.categoryId || undefined,
						imageId: validated.data.imageId || undefined,
						hasVariants: validated.data.hasVariants,
					});

					if (validated.data.hasVariants && newProductId) {
						const activeVariants = variants.filter((v) => !v.deleted);
						for (let i = 0; i < activeVariants.length; i++) {
							const variant = activeVariants[i];
							await createVariant({
								productId: newProductId as Id<"products">,
								name: variant.name,
								price: variant.price,
								sku: variant.sku || undefined,
								inventoryQuantity: variant.inventoryQuantity,
								option1Name: variant.option1Name,
								option1Value: variant.option1Value,
								option2Name: variant.option2Name,
								option2Value: variant.option2Value,
								option3Name: variant.option3Name,
								option3Value: variant.option3Value,
								imageId: variant.imageId || undefined,
								position: i,
							});
						}
					}
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

					<form.Field name="hasVariants">
						{(field) => (
							<div className="flex items-center space-x-2">
								<Checkbox
									id={field.name}
									checked={field.state.value}
									onCheckedChange={(checked: boolean) => field.handleChange(checked)}
								/>
								<Label htmlFor={field.name} className="cursor-pointer font-normal text-sm">
									This product has variants
								</Label>
							</div>
						)}
					</form.Field>

					<form.Field name="hasVariants">
						{(hasVariantsField) =>
							!hasVariantsField.state.value ? (
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
							) : null
						}
					</form.Field>

					<form.Field name="hasVariants">
						{(hasVariantsField) =>
							hasVariantsField.state.value ? (
								<div className="space-y-6">
									<div className="space-y-4">
										<div className="flex items-center justify-between">
											<Label className="font-medium text-base">Variant Options</Label>
											{variantOptions.length < 3 && (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => {
														setVariantOptions([...variantOptions, { name: "", values: [] }]);
														setOptionInputValues([...optionInputValues, ""]);
													}}
												>
													<Plus className="mr-1 h-4 w-4" />
													Add Option
												</Button>
											)}
										</div>

										{variantOptions.map((option, optionIndex) => (
											<div
												key={optionIndex}
												className="space-y-3 rounded-lg border bg-muted/30 p-4"
											>
												<div className="flex items-center gap-2">
													<div className="flex-1">
														<Label htmlFor={`option-name-${optionIndex}`} className="text-sm">
															Option Name
														</Label>
														<Input
															id={`option-name-${optionIndex}`}
															placeholder="e.g., Size, Color, Material"
															value={option.name}
															onChange={(e) => {
																const updated = [...variantOptions];
																updated[optionIndex] = { ...option, name: e.target.value };
																setVariantOptions(updated);
															}}
														/>
													</div>
													{variantOptions.length > 1 && (
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="mt-5"
															onClick={() => {
																setVariantOptions(
																	variantOptions.filter((_, i) => i !== optionIndex),
																);
																setOptionInputValues(
																	optionInputValues.filter((_, i) => i !== optionIndex),
																);
															}}
														>
															<X className="h-4 w-4" />
														</Button>
													)}
												</div>

												<div>
													<Label htmlFor={`option-values-${optionIndex}`} className="text-sm">
														Values (comma-separated)
													</Label>
													<Input
														id={`option-values-${optionIndex}`}
														placeholder="e.g., Small, Medium, Large"
														value={optionInputValues[optionIndex] || ""}
														onChange={(e) => {
															const updated = [...optionInputValues];
															updated[optionIndex] = e.target.value;
															setOptionInputValues(updated);

															const values = e.target.value
																.split(",")
																.map((v) => v.trim())
																.filter((v) => v.length > 0);
															const updatedOptions = [...variantOptions];
															updatedOptions[optionIndex] = { ...option, values };
															setVariantOptions(updatedOptions);
														}}
													/>
													{option.values.length > 0 && (
														<div className="mt-2 flex flex-wrap gap-1">
															{option.values.map((value, valueIndex) => (
																<span
																	key={valueIndex}
																	className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-primary text-xs"
																>
																	{value}
																</span>
															))}
														</div>
													)}
												</div>
											</div>
										))}

										<Button
											type="button"
											onClick={() => {
												const validOptions = variantOptions.filter(
													(opt) => opt.name.trim() && opt.values.length > 0,
												);
												if (validOptions.length === 0) {
													toast.error(
														"Add at least one option with values before generating variants",
													);
													return;
												}
												const generated = generateVariantCombinations(variantOptions);
												setVariants(generated);
												toast.success(`Generated ${generated.length} variant(s)`);
											}}
											className="w-full"
										>
											Generate Variants
										</Button>
									</div>

									{variants.length > 0 && (
										<div className="space-y-4">
											<Label className="font-medium text-base">
												Variants ({variants.filter((v) => !v.deleted).length})
											</Label>
											<div className="overflow-hidden rounded-lg border">
												<Table>
													<TableHeader>
														<TableRow className="bg-muted/50">
															<TableHead className="w-[200px]">Name</TableHead>
															<TableHead className="w-[120px]">SKU</TableHead>
															<TableHead className="w-[140px]">Price</TableHead>
															<TableHead className="w-[100px]">Stock</TableHead>
															<TableHead className="w-[120px]">Image</TableHead>
															<TableHead className="w-[60px]" />
														</TableRow>
													</TableHeader>
													<TableBody>
														{variants
															.filter((v) => !v.deleted)
															.map((variant) => (
																<TableRow key={variant.id}>
																	<TableCell>
																		<Input
																			value={variant.name}
																			onChange={(e) => {
																				setVariants(
																					variants.map((v) =>
																						v.id === variant.id
																							? { ...v, name: e.target.value }
																							: v,
																					),
																				);
																			}}
																			className="h-8"
																		/>
																	</TableCell>
																	<TableCell>
																		<Input
																			value={variant.sku}
																			onChange={(e) => {
																				setVariants(
																					variants.map((v) =>
																						v.id === variant.id ? { ...v, sku: e.target.value } : v,
																					),
																				);
																			}}
																			placeholder="SKU"
																			className="h-8"
																		/>
																	</TableCell>
																	<TableCell>
																		<PriceInput
																			currency={currency}
																			value={variant.price}
																			onChange={(valueInCents) => {
																				setVariants(
																					variants.map((v) =>
																						v.id === variant.id ? { ...v, price: valueInCents } : v,
																					),
																				);
																			}}
																			className="h-8"
																		/>
																	</TableCell>
																	<TableCell>
																		<Input
																			type="number"
																			min="0"
																			value={variant.inventoryQuantity}
																			onChange={(e) => {
																				setVariants(
																					variants.map((v) =>
																						v.id === variant.id
																							? {
																									...v,
																									inventoryQuantity:
																										Number.parseInt(e.target.value) || 0,
																								}
																							: v,
																					),
																				);
																			}}
																			className="h-8"
																		/>
																	</TableCell>
																	<TableCell>
																		<Dialog>
																			<DialogTrigger
																				render={
																					<Button
																						type="button"
																						variant="outline"
																						size="sm"
																						className="h-8 text-xs"
																					/>
																				}
																			>
																				{variant.imageId ? "Change" : "Add"}
																			</DialogTrigger>
																			<DialogContent>
																				<DialogHeader>
																					<DialogTitle>Variant Image: {variant.name}</DialogTitle>
																				</DialogHeader>
																				<ImageUpload
																					value={variant.imageId}
																					onChange={(storageId) => {
																						setVariants(
																							variants.map((v) =>
																								v.id === variant.id
																									? { ...v, imageId: storageId || "" }
																									: v,
																							),
																						);
																					}}
																				/>
																			</DialogContent>
																		</Dialog>
																	</TableCell>
																	<TableCell>
																		<Button
																			type="button"
																			variant="ghost"
																			size="icon"
																			className="h-8 w-8"
																			onClick={() => {
																				setVariants(
																					variants.map((v) =>
																						v.id === variant.id ? { ...v, deleted: true } : v,
																					),
																				);
																			}}
																		>
																			<Trash2 className="h-4 w-4 text-destructive" />
																		</Button>
																	</TableCell>
																</TableRow>
															))}
													</TableBody>
												</Table>
											</div>
										</div>
									)}
								</div>
							) : null
						}
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
