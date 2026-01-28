import { AlertTriangle, Loader2, MessageSquare, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimeoutErrorProps {
	className?: string;
	isRetrying?: boolean;
	onRetry: () => void;
	onRespondManually: () => void;
}

export function TimeoutError({
	className,
	isRetrying,
	onRetry,
	onRespondManually,
}: TimeoutErrorProps) {
	return (
		<div className={cn("flex max-w-[80%] flex-col items-end gap-2 self-end", className)}>
			<div className="rounded-2xl bg-destructive/10 px-4 py-3">
				<div className="flex items-center gap-2 text-destructive">
					<AlertTriangle className="h-4 w-4 flex-shrink-0" />
					<span className="font-medium text-sm">AI response timed out</span>
				</div>
				<p className="mt-1 text-destructive/80 text-xs">
					The AI is taking longer than expected. You can retry or respond manually.
				</p>
				<div className="mt-3 flex gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={onRetry}
						disabled={isRetrying}
						className="h-8 border-destructive/30 text-xs hover:bg-destructive/10"
					>
						{isRetrying ? (
							<Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
						) : (
							<RefreshCw className="mr-1.5 h-3 w-3" />
						)}
						Retry
					</Button>
					<Button
						size="sm"
						variant="default"
						onClick={onRespondManually}
						disabled={isRetrying}
						className="h-8 text-xs"
					>
						<MessageSquare className="mr-1.5 h-3 w-3" />
						Respond manually
					</Button>
				</div>
			</div>
		</div>
	);
}
