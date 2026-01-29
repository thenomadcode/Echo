import { api } from "@echo/backend/convex/_generated/api";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "convex/react";
import { Bot } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Business } from "./general-settings";
import { StickySaveButton } from "./sticky-save-button";

export interface AISettingsProps {
	business: Business;
}

export function AISettings({ business }: AISettingsProps) {
	const updateAISettings = useMutation(api.ai.settings.updateSettings);

	const form = useForm({
		defaultValues: {
			aiTone: business.aiTone || "",
		},
		onSubmit: async ({ value }) => {
			try {
				await updateAISettings({
					businessId: business._id,
					aiTone: value.aiTone || undefined,
				});
				toast.success("AI settings saved successfully!");
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to save AI settings");
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Bot className="h-5 w-5" />
						AI Personality
					</CardTitle>
					<CardDescription>Customize how your AI assistant communicates</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form.Field name="aiTone">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Tone & Style</Label>
								<Textarea
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									rows={4}
									placeholder="Be friendly and helpful. Use casual language. Always recommend our daily specials."
								/>
								<p className="text-muted-foreground text-xs">
									Custom instructions to shape how the AI responds to customers
								</p>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<StickySaveButton form={form} />
		</form>
	);
}
