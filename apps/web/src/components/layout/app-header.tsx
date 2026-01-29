import { BookOpen, Search } from "lucide-react";

import { BusinessSwitcher } from "@/components/business-switcher";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

export function AppHeader() {
	const { open, setOpen } = useCommandPalette();

	return (
		<>
			<header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-6">
				<div className="flex items-center gap-4">
					<BusinessSwitcher />
				</div>

				<div className="hidden items-center md:flex">
					<Button
						variant="outline"
						onClick={() => setOpen(true)}
						className="flex h-auto items-center gap-2 py-1.5 text-muted-foreground"
					>
						<Search className="h-4 w-4" />
						<span>Search...</span>
						<kbd className="ml-2 inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 font-mono text-muted-foreground text-xs">
							<span className="text-xs">⌘</span>K
						</kbd>
					</Button>
				</div>

				<div className="flex items-center gap-2">
					<a
						href="/docs"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						title="Documentation"
					>
						<BookOpen className="h-5 w-5" />
						<span className="sr-only">Documentation</span>
					</a>
					<ThemeToggle />
					<NotificationBell />
					<UserMenu />
				</div>
			</header>

			<CommandPalette open={open} onOpenChange={setOpen} />
		</>
	);
}
