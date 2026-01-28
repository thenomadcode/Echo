import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageSquare, Package, Settings, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
	{ to: "/dashboard", label: "Home", icon: Home },
	{ to: "/conversations", label: "Chats", icon: MessageSquare },
	{ to: "/orders", label: "Orders", icon: ShoppingBag },
	{ to: "/products", label: "Products", icon: Package },
	{ to: "/settings", label: "Settings", icon: Settings },
] as const;

export function BottomNav() {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	return (
		<nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t bg-background lg:hidden">
			{navItems.map((item) => {
				const Icon = item.icon;
				const isActive = currentPath === item.to || currentPath.startsWith(`${item.to}/`);

				return (
					<Link
						key={item.to}
						to={item.to}
						className={cn(
							"flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors",
							isActive ? "text-primary" : "text-muted-foreground",
						)}
					>
						<Icon className="h-5 w-5" />
						<span>{item.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
