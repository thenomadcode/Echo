import { Bot, User } from "lucide-react";

import { cn } from "@/lib/utils";

interface MessageBubbleProps {
	sender: "customer" | "ai" | "human";
	content: string;
	timestamp: number;
	mediaUrl?: string;
	senderName?: string;
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

function isImageUrl(url: string): boolean {
	const lowercaseUrl = url.toLowerCase();
	return IMAGE_EXTENSIONS.some((ext) => lowercaseUrl.endsWith(ext));
}

function formatRelativeTime(timestamp: number): string {
	const now = new Date();
	const date = new Date(timestamp);
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
	sender,
	content,
	timestamp,
	mediaUrl,
	senderName,
}: MessageBubbleProps) {
	const isCustomer = sender === "customer";
	const isAi = sender === "ai";
	const isHuman = sender === "human";

	const relativeTime = formatRelativeTime(timestamp);

	return (
		<div
			className={cn(
				"flex max-w-[80%] flex-col gap-1",
				isCustomer ? "items-start self-start" : "items-end self-end",
			)}
		>
			{(isAi || isHuman) && (
				<div className="flex items-center gap-1.5 px-1">
					{isAi && <Bot className="h-3 w-3 text-muted-foreground" />}
					{isHuman && <User className="h-3 w-3 text-muted-foreground" />}
					<span className="text-muted-foreground text-xs">
						{isAi ? "AI Assistant" : (senderName ?? "Agent")}
					</span>
				</div>
			)}

			<div
				className={cn(
					"rounded-2xl px-4 py-3 text-sm",
					isCustomer && "bg-secondary text-secondary-foreground",
					isAi && "bg-muted text-foreground",
					isHuman && "bg-primary text-primary-foreground",
				)}
			>
				{mediaUrl && isImageUrl(mediaUrl) && (
					<img src={mediaUrl} alt="Attached media" className="mb-2 max-w-full rounded-lg" />
				)}
				<p className="whitespace-pre-wrap leading-relaxed">{content}</p>
			</div>

			<span className="px-1 text-muted-foreground text-xs">{relativeTime}</span>
		</div>
	);
}
