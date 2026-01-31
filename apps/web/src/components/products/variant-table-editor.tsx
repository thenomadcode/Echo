import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { PriceInput } from "@/components/ui/price-input";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface GeneratedVariant {
	name: string;
	sku: string;
	price: number;
	inventoryQuantity: number;
	imageId: string;
	available: boolean;
	option1Name?: string;
	option1Value?: string;
	option2Name?: string;
	option2Value?: string;
	option3Name?: string;
	option3Value?: string;
}

interface VariantTableEditorProps {
	field: any;
	currency: "COP" | "BRL" | "MXN" | "USD";
}

export function VariantTableEditor({ field, currency }: VariantTableEditorProps) {
	const variants: GeneratedVariant[] = field.state.value || [];

	const updateVariant = (index: number, updates: Partial<GeneratedVariant>) => {
		const newVariants = [...variants];
		const currentVariant = newVariants[index];
		if (currentVariant) {
			newVariants[index] = { ...currentVariant, ...updates };
			field.handleChange(newVariants);
		}
	};

	const removeVariant = (index: number) => {
		const newVariants = variants.filter((_, i) => i !== index);
		field.handleChange(newVariants);
	};

	const addVariant = () => {
		const newVariant: GeneratedVariant = {
			name: `Variant ${variants.length + 1}`,
			sku: "",
			price: 0,
			inventoryQuantity: 0,
			imageId: "",
			available: true,
		};
		field.handleChange([...variants, newVariant]);
	};

	if (variants.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center">
				<p className="text-muted-foreground text-sm">
					No variants generated yet. Define options above and click "Generate Variants".
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<p className="font-medium text-sm">
						{variants.length} variant{variants.length === 1 ? "" : "s"}
					</p>
					<p className="text-muted-foreground text-xs">
						Edit pricing, SKU, and inventory for each variant
					</p>
				</div>
				<Button type="button" variant="outline" size="sm" onClick={addVariant}>
					<Plus className="mr-2 h-4 w-4" />
					Add Variant
				</Button>
			</div>

			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[200px]">Variant</TableHead>
							<TableHead className="w-[140px]">SKU</TableHead>
							<TableHead className="w-[140px]">Price</TableHead>
							<TableHead className="w-[100px]">Stock</TableHead>
							<TableHead className="w-[120px]">Image</TableHead>
							<TableHead className="w-[80px]">Available</TableHead>
							<TableHead className="w-[60px]" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{variants.map((variant, index) => (
							<VariantRow
								key={`${variant.name}-${index}`}
								variant={variant}
								index={index}
								currency={currency}
								onUpdate={(updates) => updateVariant(index, updates)}
								onRemove={() => removeVariant(index)}
							/>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

interface VariantRowProps {
	variant: GeneratedVariant;
	index: number;
	currency: "COP" | "BRL" | "MXN" | "USD";
	onUpdate: (updates: Partial<GeneratedVariant>) => void;
	onRemove: () => void;
}

function VariantRow({ variant, currency, onUpdate, onRemove }: VariantRowProps) {
	return (
		<TableRow className={cn(!variant.available && "text-muted-foreground opacity-60")}>
			<TableCell>
				<div className="font-medium text-sm">{variant.name}</div>
				{variant.option1Value && (
					<div className="text-muted-foreground text-xs">
						{variant.option1Name}: {variant.option1Value}
						{variant.option2Value && ` / ${variant.option2Name}: ${variant.option2Value}`}
						{variant.option3Value && ` / ${variant.option3Name}: ${variant.option3Value}`}
					</div>
				)}
			</TableCell>
			<TableCell>
				<Input
					value={variant.sku}
					onChange={(e) => onUpdate({ sku: e.target.value })}
					placeholder="SKU-001"
					className="h-8"
				/>
			</TableCell>
			<TableCell>
				<PriceInput
					currency={currency}
					value={variant.price}
					onChange={(valueInCents) => onUpdate({ price: valueInCents })}
					className="h-8"
				/>
			</TableCell>
			<TableCell>
				<Input
					type="number"
					value={variant.inventoryQuantity}
					onChange={(e) =>
						onUpdate({ inventoryQuantity: Number.parseInt(e.target.value, 10) || 0 })
					}
					min={0}
					className="h-8 w-20"
				/>
			</TableCell>
			<TableCell>
				<CompactImageUpload
					value={variant.imageId}
					onChange={(storageId) => onUpdate({ imageId: storageId || "" })}
				/>
			</TableCell>
			<TableCell>
				<Switch
					checked={variant.available}
					onCheckedChange={(checked) => onUpdate({ available: checked })}
				/>
			</TableCell>
			<TableCell>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={onRemove}
					className="h-8 w-8 text-muted-foreground hover:text-destructive"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</TableCell>
		</TableRow>
	);
}

interface CompactImageUploadProps {
	value?: string;
	onChange: (storageId: string | undefined) => void;
}

function CompactImageUpload({ value, onChange }: CompactImageUploadProps) {
	return (
		<div className="w-[80px]">
			<ImageUpload
				value={value}
				onChange={onChange}
				className="[&>[data-slot=image-upload]]:min-h-0 [&>[data-slot=image-upload]]:p-2"
			/>
		</div>
	);
}
