import { api } from "@echo/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
	value?: string;
	onChange: (storageId: string | undefined) => void;
	disabled?: boolean;
	className?: string;
}

export function ImageUpload({ value, onChange, disabled, className }: ImageUploadProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const generateUploadUrl = useMutation(api.products.generateUploadUrl);

	const handleFileSelect = async (file: File) => {
		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image must be less than 5MB");
			return;
		}

		try {
			setIsUploading(true);

			const reader = new FileReader();
			reader.onload = (e) => {
				setPreviewUrl(e.target?.result as string);
			};
			reader.readAsDataURL(file);

			const uploadUrl = await generateUploadUrl();

			const result = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});

			if (!result.ok) {
				throw new Error("Failed to upload image");
			}

			const { storageId } = await result.json();

			onChange(storageId);
			toast.success("Image uploaded successfully");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to upload image");
			setPreviewUrl(null);
		} finally {
			setIsUploading(false);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		if (!disabled) {
			setIsDragging(true);
		}
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);

		if (disabled) return;

		const files = Array.from(e.dataTransfer.files);
		if (files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	const handleClick = () => {
		if (!disabled) {
			fileInputRef.current?.click();
		}
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			handleFileSelect(files[0]);
		}
	};

	const handleRemove = (e: React.MouseEvent) => {
		e.stopPropagation();
		onChange(undefined);
		setPreviewUrl(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	return (
		<div className={cn("space-y-2", className)}>
			<div
				onClick={handleClick}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={cn(
					"relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
					isDragging && "border-primary bg-primary/5",
					disabled && "cursor-not-allowed opacity-50",
					!previewUrl && !value && "min-h-[200px]",
				)}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					onChange={handleFileInputChange}
					disabled={disabled}
					className="hidden"
				/>

				{previewUrl || value ? (
					<div className="relative w-full">
						{previewUrl ? (
							<img
								src={previewUrl}
								alt="Preview"
								className="mx-auto max-h-[300px] rounded-md object-contain"
							/>
						) : (
							<div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
								<p>Image uploaded (ID: {value?.slice(0, 8)}...)</p>
							</div>
						)}
						{!disabled && (
							<Button
								type="button"
								variant="destructive"
								size="sm"
								onClick={handleRemove}
								className="absolute top-2 right-2"
							>
								<X className="h-4 w-4" />
							</Button>
						)}
					</div>
				) : (
					<div className="flex flex-col items-center gap-2 text-center">
						<Upload className="h-10 w-10 text-muted-foreground" />
						<div>
							<p className="font-medium text-sm">
								{isUploading ? "Uploading..." : "Drop an image here or click to browse"}
							</p>
							<p className="mt-1 text-muted-foreground text-xs">PNG, JPG, GIF up to 5MB</p>
						</div>
					</div>
				)}

				{isUploading && (
					<div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80">
						<div className="flex flex-col items-center gap-2">
							<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
							<p className="font-medium text-sm">Uploading...</p>
						</div>
					</div>
				)}
			</div>

			{value && !previewUrl && (
				<p className="text-center text-muted-foreground text-xs">
					Click to replace the current image
				</p>
			)}
		</div>
	);
}
