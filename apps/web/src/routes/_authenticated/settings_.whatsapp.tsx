import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, Copy, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/settings_/whatsapp")({
	component: WhatsAppSettingsContent,
});

function WhatsAppSettingsContent() {
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

	return <WhatsAppSettingsForm businessId={activeBusiness._id} />;
}

function WhatsAppSettingsForm({ businessId }: { businessId: Id<"businesses"> }) {
	const connectionStatus = useQuery(api.integrations.whatsapp.settings.getConnectionStatus, {
		businessId,
	});
	const saveCredentials = useMutation(api.integrations.whatsapp.settings.saveCredentials);
	const testConnection = useAction(api.integrations.whatsapp.settings.testConnection);
	const [isTesting, setIsTesting] = useState(false);
	const [webhookCopied, setWebhookCopied] = useState(false);

	const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
	const webhookUrl = convexSiteUrl
		? `${convexSiteUrl}/webhook/whatsapp`
		: "https://your-deployment.convex.site/webhook/whatsapp";

	const form = useForm({
		defaultValues: {
			provider: "twilio",
			accountSid: "",
			authToken: "",
			phoneNumber: "",
		},
		onSubmit: async ({ value }) => {
			try {
				if (!value.accountSid || !value.authToken || !value.phoneNumber) {
					toast.error("Please fill in all required fields");
					return;
				}

				await saveCredentials({
					businessId,
					provider: value.provider,
					phoneNumber: value.phoneNumber,
					accountSid: value.accountSid,
					authToken: value.authToken,
				});
				toast.success("Credentials saved successfully!");
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to save credentials");
			}
		},
	});

	const handleTestConnection = async () => {
		setIsTesting(true);
		try {
			const result = await testConnection({ businessId });
			if (result.success) {
				toast.success("Connection verified successfully!");
			} else {
				toast.error(result.error || "Connection test failed");
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to test connection");
		} finally {
			setIsTesting(false);
		}
	};

	const handleCopyWebhook = async () => {
		try {
			await navigator.clipboard.writeText(webhookUrl);
			setWebhookCopied(true);
			toast.success("Webhook URL copied to clipboard");
			setTimeout(() => setWebhookCopied(false), 2000);
		} catch {
			toast.error("Failed to copy webhook URL");
		}
	};

	const formatTimestamp = (timestamp: number | null) => {
		if (!timestamp) return "Never";
		return new Date(timestamp).toLocaleString();
	};

	if (connectionStatus === undefined) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (connectionStatus === null) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Unable to load connection status</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-5xl px-6 py-8">
			<h1 className="mb-6 font-bold text-3xl">WhatsApp Settings</h1>

			<Card className="mb-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Connection Status
						{connectionStatus.connected && connectionStatus.verified ? (
							<CheckCircle2 className="h-5 w-5 text-green-500" />
						) : (
							<XCircle className="h-5 w-5 text-red-500" />
						)}
					</CardTitle>
					<CardDescription>
						{connectionStatus.connected && connectionStatus.verified
							? "Your WhatsApp Business account is connected and verified"
							: connectionStatus.connected
								? "Connection configured but not yet verified"
								: "No WhatsApp connection configured"}
					</CardDescription>
				</CardHeader>
				{connectionStatus.connected && (
					<CardContent>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<span className="text-muted-foreground">Provider:</span>
								<span className="ml-2 font-medium">{connectionStatus.provider}</span>
							</div>
							<div>
								<span className="text-muted-foreground">Phone Number:</span>
								<span className="ml-2 font-medium">{connectionStatus.phoneNumber}</span>
							</div>
							<div>
								<span className="text-muted-foreground">Status:</span>
								<span
									className={`ml-2 font-medium ${connectionStatus.verified ? "text-green-600" : "text-yellow-600"}`}
								>
									{connectionStatus.verified ? "Verified" : "Pending Verification"}
								</span>
							</div>
							<div>
								<span className="text-muted-foreground">Last Message:</span>
								<span className="ml-2 font-medium">
									{formatTimestamp(connectionStatus.lastMessageAt)}
								</span>
							</div>
						</div>
					</CardContent>
				)}
			</Card>

			<Card className="mb-6">
				<CardHeader>
					<CardTitle>Setup Instructions</CardTitle>
					<CardDescription>
						Follow these steps to connect your WhatsApp Business account
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<ol className="list-inside list-decimal space-y-3 text-sm">
						<li>
							Create a Twilio account at{" "}
							<a
								href="https://www.twilio.com/try-twilio"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-primary hover:underline"
							>
								twilio.com <ExternalLink className="h-3 w-3" />
							</a>
						</li>
						<li>
							Set up Twilio WhatsApp Sandbox or connect your WhatsApp Business account following the{" "}
							<a
								href="https://www.twilio.com/docs/whatsapp/quickstart"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-primary hover:underline"
							>
								Twilio WhatsApp Quickstart <ExternalLink className="h-3 w-3" />
							</a>
						</li>
						<li>Copy your Account SID and Auth Token from the Twilio Console</li>
						<li>Enter your WhatsApp-enabled phone number (in E.164 format, e.g., +15551234567)</li>
						<li>Save your credentials and click Test Connection to verify</li>
						<li>Configure the webhook URL below in your Twilio console</li>
					</ol>
				</CardContent>
			</Card>

			<Card className="mb-6">
				<CardHeader>
					<CardTitle>Webhook Configuration</CardTitle>
					<CardDescription>Configure this URL in your Twilio WhatsApp settings</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-2">
						<Input readOnly value={webhookUrl} className="bg-muted font-mono text-sm" />
						<Tooltip>
							<TooltipTrigger
								render={
									<Button type="button" variant="outline" size="icon" onClick={handleCopyWebhook} />
								}
							>
								{webhookCopied ? (
									<CheckCircle2 className="h-4 w-4 text-green-500" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</TooltipTrigger>
							<TooltipContent>Copy webhook URL</TooltipContent>
						</Tooltip>
					</div>
					<p className="mt-2 text-muted-foreground text-xs">
						Set this as the &quot;WHEN A MESSAGE COMES IN&quot; webhook URL in your Twilio WhatsApp
						Sandbox or Sender settings.
					</p>
				</CardContent>
			</Card>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<Card className="mb-6">
					<CardHeader>
						<CardTitle>Twilio Credentials</CardTitle>
						<CardDescription>Enter your Twilio account credentials</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<form.Field name="provider">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Provider</Label>
										<Select
											value={field.state.value}
											onValueChange={(value) => value && field.handleChange(value)}
										>
											<SelectTrigger className="h-10 w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="twilio">Twilio</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}
							</form.Field>
						</div>

						<div>
							<form.Field name="accountSid">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Account SID</Label>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
										/>
									</div>
								)}
							</form.Field>
						</div>

						<div>
							<form.Field name="authToken">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>Auth Token</Label>
										<Input
											id={field.name}
											name={field.name}
											type="password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="Your Twilio Auth Token"
										/>
									</div>
								)}
							</form.Field>
						</div>

						<div>
							<form.Field name="phoneNumber">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor={field.name}>WhatsApp Phone Number</Label>
										<Input
											id={field.name}
											name={field.name}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="+15551234567"
										/>
										<p className="text-muted-foreground text-xs">
											Enter in E.164 format (e.g., +15551234567)
										</p>
									</div>
								)}
							</form.Field>
						</div>
					</CardContent>
				</Card>

				<div className="flex justify-end gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={handleTestConnection}
						disabled={isTesting || !connectionStatus.connected}
					>
						{isTesting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Testing...
							</>
						) : (
							"Test Connection"
						)}
					</Button>
					<form.Subscribe>
						{(state) => (
							<Button type="submit" disabled={!state.canSubmit || state.isSubmitting}>
								{state.isSubmitting ? "Saving..." : "Save Credentials"}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</div>
	);
}
