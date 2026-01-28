import { api } from "@echo/backend/convex/_generated/api";
import { Link, createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Bot, Building2, Loader2, MessageCircle, ShoppingBag } from "lucide-react";

import { AISettings } from "@/components/settings/ai-settings";
import { ChatsIntegrationsSettings } from "@/components/settings/chats-integrations-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { ShopsIntegrationsSettings } from "@/components/settings/shops-integrations-settings";
import { cn } from "@/lib/utils";

type SettingsSection = "general" | "ai" | "chats" | "shops";

export const Route = createFileRoute("/_authenticated/settings")({
	component: SettingsPage,
	validateSearch: (search: Record<string, unknown>): { section?: SettingsSection } => {
		const section = search.section as string | undefined;
		if (section === "general" || section === "ai" || section === "chats" || section === "shops") {
			return { section };
		}
		return {};
	},
});

interface SidebarItem {
	id: SettingsSection;
	label: string;
	icon: React.ElementType;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
	{ id: "general", label: "General", icon: Building2 },
	{ id: "ai", label: "AI & Automation", icon: Bot },
	{ id: "chats", label: "Chats", icon: MessageCircle },
	{ id: "shops", label: "Shops", icon: ShoppingBag },
];

function SettingsPage() {
	const { section = "general" } = useSearch({ from: "/_authenticated/settings" });
	const businesses = useQuery(api.businesses.list);
	const updateBusiness = useMutation(api.businesses.update);

	if (businesses === undefined) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const activeBusiness = businesses[0];

	if (!activeBusiness) {
		return (
			<div className="container mx-auto max-w-5xl px-6 py-8">
				<p className="text-muted-foreground">No business found. Please create one first.</p>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8 lg:px-6">
			<h1 className="mb-6 font-bold font-heading text-2xl">Settings</h1>

			<div className="flex flex-col gap-8 lg:flex-row">
				<aside className="flex-shrink-0 lg:w-48">
					<nav>
						<ul className="space-y-1">
							{SIDEBAR_ITEMS.map((item) => (
								<li key={item.id}>
									<Link
										to="/settings"
										search={{ section: item.id }}
										className={cn(
											"flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors",
											section === item.id
												? "bg-primary/10 text-primary"
												: "text-muted-foreground hover:bg-muted hover:text-foreground",
										)}
									>
										<item.icon className="h-4 w-4" />
										{item.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				</aside>

				<main className="min-w-0 flex-1">
					{section === "general" && (
						<GeneralSettings business={activeBusiness} updateBusiness={updateBusiness} />
					)}
					{section === "ai" && <AISettings business={activeBusiness} />}
					{section === "chats" && <ChatsIntegrationsSettings />}
					{section === "shops" && <ShopsIntegrationsSettings />}
				</main>
			</div>
		</div>
	);
}
