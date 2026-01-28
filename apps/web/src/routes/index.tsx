import { api } from "@echo/backend/convex/_generated/api";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { useQuery } from "convex/react";
import { Brain, Clock, MessageSquare, Zap } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

function HomeComponent() {
	return (
		<>
			<Authenticated>
				<RedirectToDashboard />
			</Authenticated>
			<Unauthenticated>
				<LandingPage />
			</Unauthenticated>
			<AuthLoading>
				<div className="flex min-h-screen items-center justify-center">
					<div className="text-muted-foreground">Loading...</div>
				</div>
			</AuthLoading>
		</>
	);
}

function RedirectToDashboard() {
	const navigate = useNavigate();
	const businesses = useQuery(api.businesses.list, {});

	useEffect(() => {
		if (businesses !== undefined) {
			if (businesses.length > 0) {
				navigate({ to: "/dashboard" });
			} else {
				navigate({ to: "/onboarding" });
			}
		}
	}, [businesses, navigate]);

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="text-muted-foreground">Redirecting...</div>
		</div>
	);
}

function LandingPage() {
	return (
		<div className="min-h-screen">
			<div
				className="relative overflow-hidden"
				style={{
					background: "linear-gradient(135deg, oklch(0.58 0.2 35) 0%, oklch(0.92 0.04 55) 100%)",
				}}
			>
				<div className="container mx-auto px-6 py-20 md:py-32">
					<div className="mx-auto max-w-3xl text-center">
						<div className="mb-8 flex items-center justify-center gap-3">
							<div className="rounded-xl bg-white/20 p-3">
								<MessageSquare className="h-10 w-10 text-white" />
							</div>
							<span className="font-bold font-heading text-3xl text-white">Echo</span>
						</div>

						<h1 className="mb-6 font-bold font-heading text-4xl text-white leading-tight md:text-5xl lg:text-6xl">
							AI-Powered Customer Service for Your WhatsApp Business
						</h1>

						<p className="mx-auto mb-10 max-w-2xl text-lg text-white/90 md:text-xl">
							Automate customer inquiries, take orders, and provide 24/7 support — all through
							WhatsApp. Perfect for restaurants, pharmacies, and retail stores in Latin America.
						</p>

						<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Link to="/signup">
								<Button
									size="lg"
									className="bg-white px-8 font-semibold text-primary hover:bg-white/90"
								>
									Get Started Free
								</Button>
							</Link>
							<Link to="/login">
								<Button
									size="lg"
									variant="outline"
									className="border-white px-8 font-semibold text-white hover:bg-white/10"
								>
									Sign In
								</Button>
							</Link>
						</div>
					</div>
				</div>

				<div
					className="absolute right-0 bottom-0 left-0 h-24"
					style={{
						background: "linear-gradient(to top, var(--background), transparent)",
					}}
				/>
			</div>

			<div className="container mx-auto px-6 py-20">
				<div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
					<div className="rounded-xl border bg-card p-6 shadow-sm">
						<div className="mb-4 w-fit rounded-lg bg-primary/10 p-3">
							<Clock className="h-6 w-6 text-primary" />
						</div>
						<h3 className="mb-2 font-heading font-semibold text-lg">24/7 Support</h3>
						<p className="text-muted-foreground text-sm">
							AI handles customer messages any time of day or night, so you never miss a sale or
							inquiry.
						</p>
					</div>

					<div className="rounded-xl border bg-card p-6 shadow-sm">
						<div className="mb-4 w-fit rounded-lg bg-primary/10 p-3">
							<Brain className="h-6 w-6 text-primary" />
						</div>
						<h3 className="mb-2 font-heading font-semibold text-lg">Smart AI</h3>
						<p className="text-muted-foreground text-sm">
							Understands context and customer intent to provide accurate, helpful responses every
							time.
						</p>
					</div>

					<div className="rounded-xl border bg-card p-6 shadow-sm">
						<div className="mb-4 w-fit rounded-lg bg-primary/10 p-3">
							<Zap className="h-6 w-6 text-primary" />
						</div>
						<h3 className="mb-2 font-heading font-semibold text-lg">Easy Setup</h3>
						<p className="text-muted-foreground text-sm">
							Connect your WhatsApp Business number in minutes. No coding required.
						</p>
					</div>
				</div>

				<div className="mt-16 text-center">
					<p className="text-muted-foreground">
						Trusted by <span className="font-semibold text-foreground">500+ LATAM businesses</span>
					</p>
				</div>
			</div>
		</div>
	);
}
