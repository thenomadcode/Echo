import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface EditCustomerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	customer: {
		_id: Id<"customers">;
		name?: string;
		preferredLanguage?: string;
	};
	onSuccess: () => void;
}

const LANGUAGES = [
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "pt", label: "Portuguese" },
] as const;

export function EditCustomerDialog({
	open,
	onOpenChange,
	customer,
	onSuccess,
}: EditCustomerDialogProps) {
	const updateCustomer = useMutation(api.customers.update);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [name, setName] = useState(customer.name ?? "");
	const [language, setLanguage] = useState(customer.preferredLanguage ?? "en");

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			const updates: {
				customerId: Id<"customers">;
				name?: string;
				preferredLanguage?: string;
			} = {
				customerId: customer._id,
			};

			if (name !== customer.name) {
				updates.name = name || undefined;
			}

			if (language !== customer.preferredLanguage) {
				updates.preferredLanguage = language;
			}

			await updateCustomer(updates);
			toast.success("Customer updated successfully");
			onSuccess();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to update customer");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Edit Customer</DialogTitle>
					<DialogDescription>Update customer profile information</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Customer name"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="language">Preferred Language</Label>
						<Select value={language} onValueChange={(v) => v && setLanguage(v)}>
							<SelectTrigger>
								<SelectValue placeholder="Select language" />
							</SelectTrigger>
							<SelectContent>
								{LANGUAGES.map((lang) => (
									<SelectItem key={lang.value} value={lang.value}>
										{lang.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Save Changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
