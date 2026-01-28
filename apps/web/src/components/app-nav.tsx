import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageSquare, Package, Settings, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
	{ to: "/dashboard", label: "Dashboard", icon: Home },
	{ to: "/conversations", label: "Conversations", icon: MessageSquare },
	{ to: "/orders", label: "Orders", icon: ShoppingBag },
	{ to: "/products", label: "Products", icon: Package },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

export default function AppNav() {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	return (
		<nav className="flex items-center gap-1">
			{navItems.map((item) => {
				const Icon = item.icon;
				const isActive = currentPath === item.to || currentPath.startsWith(`${item.to}/`);

				return (
					<Link
						key={item.to}
						to={item.to}
						className={cn(
							"flex items-center gap-2 rounded-md px-3 py-2 font-medium text-sm transition-colors",
							"hover:bg-accent hover:text-accent-foreground",
							isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
						)}
					>
						<Icon className="h-4 w-4" />
						<span>{item.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
