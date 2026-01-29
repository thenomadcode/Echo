import { Bot } from "lucide-react";

import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
	className?: string;
}

export function TypingIndicator({ className }: TypingIndicatorProps) {
	return (
		<div className={cn("flex max-w-[80%] flex-col items-end gap-1 self-end", className)}>
			<div className="flex items-center gap-1.5 px-1">
				<Bot className="h-3 w-3 text-muted-foreground" />
				<span className="text-muted-foreground text-xs">AI Assistant</span>
			</div>

			<div className="rounded-2xl bg-muted px-4 py-3">
				<div className="flex items-center gap-1">
					<span
						className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
						style={{ animationDelay: "0s", animationDuration: "0.6s" }}
					/>
					<span
						className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
						style={{ animationDelay: "0.15s", animationDuration: "0.6s" }}
					/>
					<span
						className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
						style={{ animationDelay: "0.3s", animationDuration: "0.6s" }}
					/>
				</div>
			</div>

			<span className="px-1 text-muted-foreground text-xs">Echo AI is typing...</span>
		</div>
	);
}
