import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { toast } from "sonner";

import { UsageStats } from "@/components/ai/usage-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/settings_/ai")({
	component: AISettingsContent,
});

function AISettingsContent() {
	const businesses = useQuery(api.businesses.list);

	if (businesses === undefined) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (businesses.length === 0) {
		return null;
	}

	const activeBusiness = businesses[0];

	return <AISettingsForm businessId={activeBusiness._id} />;
}

function AISettingsForm({ businessId }: { businessId: Id<"businesses"> }) {
	const settings = useQuery(api.ai.settings.getSettings, { businessId });
	const updateSettings = useMutation(api.ai.settings.updateSettings);

	const form = useForm({
		defaultValues: {
			aiTone: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await updateSettings({
					businessId,
					aiTone: value.aiTone || undefined,
				});

				toast.success("AI settings saved successfully");
			} catch (error) {
				toast.error("Failed to save settings");
				console.error(error);
			}
		},
	});

	useEffect(() => {
		if (settings) {
			form.setFieldValue("aiTone", settings.aiTone);
		}
	}, [settings, form]);

	if (settings === undefined) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Loading settings...</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-5xl px-6 py-8">
			<div className="mb-6">
				<h1 className="font-bold text-2xl">AI Settings</h1>
				<p className="text-muted-foreground">Configure your AI assistant behavior</p>
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>AI Personality</CardTitle>
							<CardDescription>
								Customize how your AI assistant communicates with customers
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<form.Field name="aiTone">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor="aiTone">Tone & Style</Label>
										<Textarea
											id="aiTone"
											placeholder="Be friendly and helpful. Use casual language. Always recommend our daily specials."
											rows={4}
											value={field.state.value}
											onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
												field.handleChange(e.target.value)
											}
										/>
										<p className="text-muted-foreground text-sm">
											Custom instructions to shape how the AI responds to customers
										</p>
									</div>
								)}
							</form.Field>
						</CardContent>
					</Card>

					<Button type="submit" className="w-full">
						Save Settings
					</Button>

					<UsageStats businessId={businessId} />
				</div>
			</form>
		</div>
	);
}
