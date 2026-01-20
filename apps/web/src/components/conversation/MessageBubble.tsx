import { formatDistanceToNow } from "date-fns";

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

  const relativeTime = formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
  });

  return (
    <div
      className={cn("flex flex-col gap-1", isCustomer ? "items-start" : "items-end")}
    >
      {(isAi || isHuman) && (
        <span className="text-muted-foreground px-1 text-xs">
          {isAi ? "AI" : senderName ?? "Agent"}
        </span>
      )}

      <div
        className={cn(
          "max-w-xs rounded-lg px-3 py-2 text-sm",
          isCustomer && "bg-muted text-foreground",
          isAi && "bg-primary text-primary-foreground",
          isHuman && "bg-blue-500 text-white",
        )}
      >
        {mediaUrl && isImageUrl(mediaUrl) && (
          <img
            src={mediaUrl}
            alt="Attached media"
            className="mb-2 max-w-xs rounded"
          />
        )}
        <p className="whitespace-pre-wrap">{content}</p>
      </div>

      <span className="text-muted-foreground px-1 text-xs">{relativeTime}</span>
    </div>
  );
}
