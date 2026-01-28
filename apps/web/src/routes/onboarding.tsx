import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated, useMutation } from "convex/react";
import { Check, ChevronLeft, ChevronRight, ImageIcon, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import SignInForm from "@/components/sign-in-form";
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

interface WizardData {
	name: string;
	type: "restaurant" | "pharmacy" | "retail" | "other";
	description: string;
	logoUrl: string;
	address: string;
}

function OnboardingPage() {
	return (
		<>
			<Authenticated>
				<OnboardingWizard />
			</Authenticated>
			<Unauthenticated>
				<div className="mx-auto mt-10 max-w-md p-6">
					<SignInForm />
				</div>
			</Unauthenticated>
			<AuthLoading>
				<div className="flex min-h-screen items-center justify-center">
					<div>Loading...</div>
				</div>
			</AuthLoading>
		</>
	);
}

function ProgressIndicator({ currentStep }: { currentStep: number }) {
	const steps = [
		{ number: 1, label: "Business Info" },
		{ number: 2, label: "Branding" },
		{ number: 3, label: "Ready" },
	];

	return (
		<div className="mb-8 flex items-center justify-center">
			{steps.map((step, index) => (
				<div key={step.number} className="flex items-center">
					<div className="flex flex-col items-center">
						<div
							className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
								currentStep > step.number
									? "border-primary bg-primary text-primary-foreground"
									: currentStep === step.number
										? "border-primary bg-primary text-primary-foreground"
										: "border-muted-foreground/30 bg-background text-muted-foreground"
							}`}
						>
							{currentStep > step.number ? <Check className="h-5 w-5" /> : step.number}
						</div>
						<span
							className={`mt-2 font-medium text-xs ${
								currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
							}`}
						>
							{step.label}
						</span>
					</div>
					{index < steps.length - 1 && (
						<div
							className={`mx-2 h-0.5 w-12 transition-colors ${
								currentStep > step.number ? "bg-primary" : "bg-muted-foreground/30"
							}`}
						/>
					)}
				</div>
			))}
		</div>
	);
}

function OnboardingWizard() {
	const navigate = useNavigate();
	const createBusiness = useMutation(api.businesses.create);
	const [currentStep, setCurrentStep] = useState(1);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [wizardData, setWizardData] = useState<WizardData>({
		name: "",
		type: "restaurant",
		description: "",
		logoUrl: "",
		address: "",
	});

	const updateData = (updates: Partial<WizardData>) => {
		setWizardData((prev) => ({ ...prev, ...updates }));
	};

	const handleNext = () => {
		if (currentStep < 3) {
			setCurrentStep((prev) => prev + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 1) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			await createBusiness({
				name: wizardData.name,
				type: wizardData.type,
				description: wizardData.description || undefined,
				logoUrl: wizardData.logoUrl || undefined,
				address: wizardData.address || undefined,
			});
			toast.success("Business created successfully!");
			navigate({ to: "/dashboard" });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create business");
			setIsSubmitting(false);
		}
	};

	return (
		<div className="container mx-auto max-w-2xl px-4 py-8">
			<ProgressIndicator currentStep={currentStep} />

			{currentStep === 1 && (
				<Step1BusinessInfo data={wizardData} updateData={updateData} onNext={handleNext} />
			)}

			{currentStep === 2 && (
				<Step2Branding
					data={wizardData}
					updateData={updateData}
					onNext={handleNext}
					onBack={handleBack}
				/>
			)}

			{currentStep === 3 && (
				<Step3Ready
					data={wizardData}
					onBack={handleBack}
					onSubmit={handleSubmit}
					isSubmitting={isSubmitting}
				/>
			)}
		</div>
	);
}

interface StepProps {
	data: WizardData;
	updateData: (updates: Partial<WizardData>) => void;
	onNext: () => void;
}

function Step1BusinessInfo({ data, updateData, onNext }: StepProps) {
	const isValid = data.name.trim().length >= 2;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Tell us about your business</CardTitle>
				<CardDescription>
					This information helps us personalize your Echo experience.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="space-y-2">
					<Label htmlFor="name">
						Business Name <span className="text-destructive">*</span>
					</Label>
					<Input
						id="name"
						value={data.name}
						onChange={(e) => updateData({ name: e.target.value })}
						placeholder="My Awesome Business"
						className="h-11"
					/>
					{data.name.length > 0 && data.name.length < 2 && (
						<p className="text-destructive text-sm">Business name must be at least 2 characters</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="type">Business Type</Label>
					<Select
						value={data.type}
						onValueChange={(value) => value && updateData({ type: value as WizardData["type"] })}
					>
						<SelectTrigger className="h-11 w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="restaurant">Restaurant</SelectItem>
							<SelectItem value="pharmacy">Pharmacy</SelectItem>
							<SelectItem value="retail">Retail</SelectItem>
							<SelectItem value="other">Other</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						value={data.description}
						onChange={(e) => updateData({ description: e.target.value })}
						placeholder="Brief description of your business"
						rows={3}
					/>
				</div>

				<div className="flex justify-end pt-4">
					<Button onClick={onNext} disabled={!isValid} className="h-11">
						Next
						<ChevronRight className="ml-2 h-4 w-4" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

interface Step2Props extends StepProps {
	onBack: () => void;
}

function Step2Branding({ data, updateData, onNext, onBack }: Step2Props) {
	const [logoError, setLogoError] = useState(false);

	const handleLogoUrlChange = (url: string) => {
		updateData({ logoUrl: url });
		setLogoError(false);
	};

	const clearLogo = () => {
		updateData({ logoUrl: "" });
		setLogoError(false);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Brand your business</CardTitle>
				<CardDescription>
					Add your logo and address to help customers recognize you.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="space-y-2">
					<Label>Business Logo</Label>
					<div
						className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
							data.logoUrl && !logoError
								? "border-primary/50 bg-primary/5"
								: "border-muted-foreground/30 hover:border-primary/50"
						}`}
					>
						{data.logoUrl && !logoError ? (
							<div className="relative">
								<img
									src={data.logoUrl}
									alt="Logo preview"
									className="h-32 w-32 rounded-lg object-contain"
									onError={() => setLogoError(true)}
								/>
								<Button
									type="button"
									variant="destructive"
									size="icon-xs"
									onClick={clearLogo}
									className="-top-2 -right-2 absolute rounded-full"
								>
									<X className="h-4 w-4" />
								</Button>
							</div>
						) : (
							<div className="flex flex-col items-center gap-3 text-center">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
									<ImageIcon className="h-6 w-6 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium text-sm">Add your logo</p>
									<p className="mt-1 text-muted-foreground text-xs">Enter a URL below</p>
								</div>
							</div>
						)}
					</div>
					<Input
						id="logoUrl"
						type="url"
						value={data.logoUrl}
						onChange={(e) => handleLogoUrlChange(e.target.value)}
						placeholder="https://example.com/logo.png"
						className="h-11"
					/>
					{logoError && (
						<p className="text-destructive text-sm">Could not load image from this URL</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="address">Business Address</Label>
					<Input
						id="address"
						value={data.address}
						onChange={(e) => updateData({ address: e.target.value })}
						placeholder="123 Main St, City, Country"
						className="h-11"
					/>
					<p className="text-muted-foreground text-sm">
						This will be shown to customers for pickup orders (optional)
					</p>
				</div>

				<div className="flex justify-between pt-4">
					<Button variant="outline" onClick={onBack} className="h-11">
						<ChevronLeft className="mr-2 h-4 w-4" />
						Back
					</Button>
					<Button onClick={onNext} className="h-11">
						Next
						<ChevronRight className="ml-2 h-4 w-4" />
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

interface Step3Props {
	data: WizardData;
	onBack: () => void;
	onSubmit: () => void;
	isSubmitting: boolean;
}

function Step3Ready({ data, onBack, onSubmit, isSubmitting }: Step3Props) {
	const navigate = useNavigate();

	return (
		<Card>
			<CardHeader className="text-center">
				<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
					<Check className="h-8 w-8 text-primary" />
				</div>
				<CardTitle>You're all set!</CardTitle>
				<CardDescription>Review your business information and create your account.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				<div className="space-y-3 rounded-lg border p-4">
					<div className="flex items-center gap-4">
						{data.logoUrl ? (
							<img
								src={data.logoUrl}
								alt="Business logo"
								className="h-12 w-12 rounded-lg border object-contain"
							/>
						) : (
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
								<span className="font-bold text-lg text-muted-foreground">
									{data.name.charAt(0).toUpperCase()}
								</span>
							</div>
						)}
						<div>
							<h3 className="font-semibold">{data.name}</h3>
							<p className="text-muted-foreground text-sm capitalize">{data.type}</p>
						</div>
					</div>
					{data.description && <p className="text-muted-foreground text-sm">{data.description}</p>}
					{data.address && <p className="text-muted-foreground text-sm">{data.address}</p>}
				</div>

				<div className="flex flex-col gap-3 pt-4">
					<Button onClick={onSubmit} disabled={isSubmitting} className="h-11 w-full">
						{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isSubmitting ? "Creating..." : "Create Business & Go to Dashboard"}
					</Button>
					<Button
						variant="outline"
						onClick={() => {
							onSubmit();
							setTimeout(() => navigate({ to: "/settings" }), 100);
						}}
						disabled={isSubmitting}
						className="h-11 w-full"
					>
						Create & Connect WhatsApp
					</Button>
				</div>

				<div className="flex justify-start pt-2">
					<Button variant="ghost" onClick={onBack} disabled={isSubmitting} className="h-11">
						<ChevronLeft className="mr-2 h-4 w-4" />
						Back
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
