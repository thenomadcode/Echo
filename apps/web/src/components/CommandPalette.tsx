import { useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, MessageSquare, Package, Settings, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";

const navigationItems = [
	{
		heading: "Navigation",
		items: [
			{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortcut: "D" },
			{ name: "Conversations", href: "/conversations", icon: MessageSquare, shortcut: "C" },
			{ name: "Orders", href: "/orders", icon: ShoppingCart, shortcut: "O" },
			{ name: "Products", href: "/products", icon: Package, shortcut: "P" },
			{ name: "Settings", href: "/settings", icon: Settings, shortcut: "S" },
		],
	},
];

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
	const navigate = useNavigate();

	const handleSelect = useCallback(
		(href: string) => {
			onOpenChange(false);
			navigate({ to: href });
		},
		[navigate, onOpenChange],
	);

	return (
		<CommandDialog open={open} onOpenChange={onOpenChange}>
			<CommandInput placeholder="Type a command or search..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				{navigationItems.map((group) => (
					<CommandGroup key={group.heading} heading={group.heading}>
						{group.items.map((item) => (
							<CommandItem
								key={item.href}
								value={item.name}
								onSelect={() => handleSelect(item.href)}
							>
								<item.icon className="mr-2 h-4 w-4" />
								<span>{item.name}</span>
								<kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] text-muted-foreground">
									{item.shortcut}
								</kbd>
							</CommandItem>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</CommandDialog>
	);
}

export function useCommandPalette() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((open) => !open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	return { open, setOpen };
}
