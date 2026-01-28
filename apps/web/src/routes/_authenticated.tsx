import { api } from "@echo/backend/convex/_generated/api";
import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";
import { SignInForm } from "@/components/sign-in-form";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
	component: AuthenticatedLayout,
	beforeLoad: async ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/login" });
		}
	},
});

function AuthenticatedLayout() {
	return (
		<>
			<Authenticated>
				<AuthenticatedShell />
			</Authenticated>
			<Unauthenticated>
				<div className="flex min-h-screen items-center justify-center p-6">
					<div className="w-full max-w-md">
						<SignInForm />
					</div>
				</div>
			</Unauthenticated>
			<AuthLoading>
				<LoadingState />
			</AuthLoading>
		</>
	);
}

function AuthenticatedShell() {
	const navigate = useNavigate();
	const businesses = useQuery(api.businesses.list);

	useEffect(() => {
		if (businesses !== undefined && businesses.length === 0) {
			navigate({ to: "/onboarding" });
		}
	}, [businesses, navigate]);

	if (businesses === undefined) {
		return <LoadingState message="Loading your businesses..." />;
	}

	if (businesses.length === 0) {
		return <LoadingState message="Redirecting to onboarding..." />;
	}

	return (
		<SidebarProvider>
			<AuthenticatedContent />
		</SidebarProvider>
	);
}

function AuthenticatedContent() {
	const { isCollapsed } = useSidebar();

	return (
		<div className="min-h-screen bg-background">
			<Sidebar />

			<div
				className={cn(
					"transition-[padding-left] duration-200 ease-in-out",
					isCollapsed ? "lg:pl-16" : "lg:pl-60",
				)}
			>
				<AppHeader />

				<main className="pb-20 lg:pb-0">
					<Outlet />
				</main>
			</div>

			<BottomNav />
		</div>
	);
}

function LoadingState({ message = "Loading..." }: { message?: string }) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4">
			<Loader2 className="h-8 w-8 animate-spin text-primary" />
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	);
}
