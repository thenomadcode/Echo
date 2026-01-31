import {
	calculateVariantCount,
	generateVariantCombinations,
} from "@echo/backend/convex/lib/variantGeneration";
import { Plus, X } from "lucide-react";

import type { GeneratedVariant } from "@/components/products/variant-table-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface VariantOption {
	name: string;
	values: string[];
}

interface VariantOptionsBuilderProps {
	field: any;
	onGenerate?: (variants: GeneratedVariant[]) => void;
}

export function VariantOptionsBuilder({ field, onGenerate }: VariantOptionsBuilderProps) {
	const options: VariantOption[] = field.state.value || [];
	const variantCount = calculateVariantCount(options);

	const handleGenerate = () => {
		const validOptions = options.filter(
			(opt) =>
				opt.name.trim() !== "" && opt.values.length > 0 && opt.values.every((v) => v.trim() !== ""),
		);

		if (validOptions.length === 0) {
			return;
		}

		const baseVariants = generateVariantCombinations(validOptions);
		const generatedVariants: GeneratedVariant[] = baseVariants.map((base) => ({
			...base,
			sku: "",
			price: 0,
			inventoryQuantity: 0,
			imageId: "",
			available: true,
		}));

		onGenerate?.(generatedVariants);
	};

	const addOption = () => {
		if (options.length >= 3) {
			return;
		}
		field.pushValue({ name: "", values: [] });
	};

	const removeOption = (index: number) => {
		field.removeValue(index);
	};

	const updateOptionName = (index: number, name: string) => {
		const newOptions = [...options];
		newOptions[index] = { ...newOptions[index], name };
		field.handleChange(newOptions);
	};

	const addValue = (optionIndex: number) => {
		const newOptions = [...options];
		newOptions[optionIndex] = {
			...newOptions[optionIndex],
			values: [...newOptions[optionIndex].values, ""],
		};
		field.handleChange(newOptions);
	};

	const removeValue = (optionIndex: number, valueIndex: number) => {
		const newOptions = [...options];
		newOptions[optionIndex] = {
			...newOptions[optionIndex],
			values: newOptions[optionIndex].values.filter(
				(_value: string, i: number) => i !== valueIndex,
			),
		};
		field.handleChange(newOptions);
	};

	const updateValue = (optionIndex: number, valueIndex: number, value: string) => {
		const newOptions = [...options];
		newOptions[optionIndex] = {
			...newOptions[optionIndex],
			values: newOptions[optionIndex].values.map((v: string, i: number) =>
				i === valueIndex ? value : v,
			),
		};
		field.handleChange(newOptions);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<Label className="text-base">Variant Options</Label>
					<p className="text-muted-foreground text-sm">
						Add up to 3 options like Size, Color, or Material
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={addOption}
					disabled={options.length >= 3}
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Option
				</Button>
			</div>

			{options.length === 0 && (
				<Card>
					<CardContent className="p-6 text-center">
						<p className="text-muted-foreground text-sm">
							No options yet. Click "Add Option" to get started.
						</p>
					</CardContent>
				</Card>
			)}

			{options.map((option: VariantOption, optionIndex: number) => (
				<Card key={optionIndex}>
					<CardContent className="space-y-4 p-4">
						<div className="flex items-start gap-2">
							<div className="flex-1 space-y-2">
								<Label htmlFor={`option-${optionIndex}-name`}>
									Option {optionIndex + 1} Name
									<span className="ml-1 text-muted-foreground text-xs">
										(e.g., Size, Color, Material)
									</span>
								</Label>
								<Input
									id={`option-${optionIndex}-name`}
									value={option.name}
									onChange={(e) => updateOptionName(optionIndex, e.target.value)}
									placeholder="Enter option name"
								/>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => removeOption(optionIndex)}
								className="mt-7"
							>
								<X className="h-4 w-4" />
							</Button>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm">Values</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => addValue(optionIndex)}
								>
									<Plus className="mr-2 h-3 w-3" />
									Add Value
								</Button>
							</div>

							{option.values.length === 0 && (
								<p className="text-muted-foreground text-xs">
									No values yet. Add at least one value.
								</p>
							)}

							<div className="space-y-2">
								{option.values.map((value: string, valueIndex: number) => (
									<div key={valueIndex} className="flex items-center gap-2">
										<Input
											value={value}
											onChange={(e) => updateValue(optionIndex, valueIndex, e.target.value)}
											placeholder={`Value ${valueIndex + 1}`}
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => removeValue(optionIndex, valueIndex)}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
			))}

			{options.length > 0 && (
				<div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
					<div>
						<p className="font-medium text-sm">
							{variantCount === 0
								? "Add values to generate variants"
								: `${variantCount} variant${variantCount === 1 ? "" : "s"} will be generated`}
						</p>
						<p className="text-muted-foreground text-xs">
							You can customize pricing, SKU, and inventory for each variant in the next step
						</p>
					</div>
					<Button
						type="button"
						variant="secondary"
						disabled={variantCount === 0}
						onClick={handleGenerate}
					>
						Generate {variantCount} Variant{variantCount === 1 ? "" : "s"}
					</Button>
				</div>
			)}
		</div>
	);
}
