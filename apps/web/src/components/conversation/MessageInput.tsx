import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MessageInputProps {
	conversationId: Id<"conversations">;
	disabled: boolean;
	onSend?: () => void;
}

export function MessageInput({ conversationId, disabled, onSend }: MessageInputProps) {
	const [message, setMessage] = useState("");
	const [isSending, setIsSending] = useState(false);

	const sendMessage = useMutation(api.messages.sendAsHuman);

	const handleSend = async () => {
		const trimmedMessage = message.trim();
		if (!trimmedMessage || isSending || disabled) return;

		setIsSending(true);
		try {
			await sendMessage({
				conversationId,
				content: trimmedMessage,
			});
			setMessage("");
			onSend?.();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to send message");
		} finally {
			setIsSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const isDisabled = disabled || isSending;
	const canSend = !isDisabled && message.trim().length > 0;

	return (
		<div className="flex w-full items-center gap-2 border-t bg-background p-3">
			<Input
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={disabled ? "Take over to send messages" : "Type a message..."}
				disabled={isDisabled}
				className={cn("h-11 flex-1", disabled && "cursor-not-allowed opacity-60")}
			/>
			<Button onClick={handleSend} disabled={!canSend} size="icon" className="h-11 w-11 shrink-0">
				<Send className="size-5" />
			</Button>
		</div>
	);
}
