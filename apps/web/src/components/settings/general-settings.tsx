import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { Building2, Clock, Globe } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { StickySaveButton } from "./sticky-save-button";

const COMMON_TIMEZONES = [
	"UTC",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Mexico_City",
	"America/Bogota",
	"America/Lima",
	"America/Sao_Paulo",
	"America/Buenos_Aires",
	"Europe/London",
	"Europe/Paris",
	"Asia/Tokyo",
	"Asia/Shanghai",
	"Australia/Sydney",
];

const LANGUAGES = [
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "pt", label: "Portuguese" },
];

const DAYS_OF_WEEK = [
	{ value: "0", label: "Sunday" },
	{ value: "1", label: "Monday" },
	{ value: "2", label: "Tuesday" },
	{ value: "3", label: "Wednesday" },
	{ value: "4", label: "Thursday" },
	{ value: "5", label: "Friday" },
	{ value: "6", label: "Saturday" },
];

export interface Business {
	_id: Id<"businesses">;
	name: string;
	description?: string;
	logoUrl?: string;
	defaultLanguage: string;
	timezone: string;
	businessHours?: {
		open: string;
		close: string;
		days: number[];
	};
	aiTone?: string;
}

export interface GeneralSettingsProps {
	business: Business;
	updateBusiness: (args: {
		businessId: Id<"businesses">;
		name?: string;
		description?: string;
		logoUrl?: string;
		defaultLanguage?: string;
		timezone?: string;
		businessHours?: { open: string; close: string; days: number[] };
	}) => Promise<string>;
}

export function GeneralSettings({ business, updateBusiness }: GeneralSettingsProps) {
	const form = useForm({
		defaultValues: {
			name: business.name,
			description: business.description || "",
			logoUrl: business.logoUrl || "",
			defaultLanguage: business.defaultLanguage,
			timezone: business.timezone,
			hoursOpen: business.businessHours?.open || "09:00",
			hoursClose: business.businessHours?.close || "17:00",
			hoursDays: business.businessHours?.days || [],
		},
		onSubmit: async ({ value }) => {
			try {
				await updateBusiness({
					businessId: business._id,
					name: value.name,
					description: value.description || undefined,
					logoUrl: value.logoUrl || undefined,
					defaultLanguage: value.defaultLanguage,
					timezone: value.timezone,
					businessHours: {
						open: value.hoursOpen,
						close: value.hoursClose,
						days: value.hoursDays,
					},
				});
				toast.success("Settings saved successfully!");
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Failed to save settings");
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
						<Building2 className="h-5 w-5" />
						Business Info
					</CardTitle>
					<CardDescription>Update your business profile details</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form.Field name="name">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Business Name</Label>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className="h-11"
								/>
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
									rows={3}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="logoUrl">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Logo URL</Label>
								<Input
									id={field.name}
									name={field.name}
									type="url"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder="https://example.com/logo.png"
									className="h-11"
								/>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Globe className="h-5 w-5" />
						Localization
					</CardTitle>
					<CardDescription>Set your default language and timezone</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form.Field name="defaultLanguage">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Default Language</Label>
								<Select
									value={field.state.value}
									onValueChange={(value) => value && field.handleChange(value)}
								>
									<SelectTrigger className="h-11 w-full">
										<SelectValue placeholder="Select language">
											{LANGUAGES.find((l) => l.value === field.state.value)?.label}
										</SelectValue>
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
						)}
					</form.Field>

					<form.Field name="timezone">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Timezone</Label>
								<Select
									value={field.state.value}
									onValueChange={(value) => value && field.handleChange(value)}
								>
									<SelectTrigger className="h-11 w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{COMMON_TIMEZONES.map((tz) => (
											<SelectItem key={tz} value={tz}>
												{tz}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						Business Hours
					</CardTitle>
					<CardDescription>Set your operating hours and days</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<form.Field name="hoursOpen">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Open Time</Label>
									<Input
										id={field.name}
										name={field.name}
										type="time"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										className="h-11"
									/>
								</div>
							)}
						</form.Field>

						<form.Field name="hoursClose">
							{(field) => (
								<div className="space-y-2">
									<Label htmlFor={field.name}>Close Time</Label>
									<Input
										id={field.name}
										name={field.name}
										type="time"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										className="h-11"
									/>
								</div>
							)}
						</form.Field>
					</div>

					<form.Field name="hoursDays">
						{(field) => (
							<div className="space-y-2">
								<Label>Operating Days</Label>
								<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
									{DAYS_OF_WEEK.map((day) => (
										<label key={day.value} className="flex cursor-pointer items-center space-x-2">
											<Checkbox
												checked={field.state.value.includes(Number(day.value))}
												onCheckedChange={(checked) => {
													const dayNum = Number(day.value);
													if (checked) {
														field.handleChange([...field.state.value, dayNum].sort());
													} else {
														field.handleChange(
															field.state.value.filter((d: number) => d !== dayNum),
														);
													}
												}}
											/>
											<span className="text-sm">{day.label}</span>
										</label>
									))}
								</div>
							</div>
						)}
					</form.Field>
				</CardContent>
			</Card>

			<StickySaveButton form={form} />
		</form>
	);
}
