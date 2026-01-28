import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	AuthLoading,
	Authenticated,
	Unauthenticated,
	useAction,
	useMutation,
	useQuery,
} from "convex/react";
import { Brain, Cpu, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import SignInForm from "@/components/sign-in-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/test-ai")({
	component: TestAIPage,
});

function TestAIPage() {
	return (
		<>
			<Authenticated>
				<TestAIContent />
			</Authenticated>
			<Unauthenticated>
				<div className="mx-auto mt-10 max-w-md p-6">
					<SignInForm />
				</div>
			</Unauthenticated>
			<AuthLoading>
				<div className="flex min-h-screen items-center justify-center">
					<div>Loading...</div>
				</div>
			</AuthLoading>
		</>
	);
}

function TestAIContent() {
	const businesses = useQuery(api.businesses.list);
	const [selectedBusinessId, setSelectedBusinessId] = useState<Id<"businesses"> | null>(null);

	if (businesses === undefined) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div>Loading...</div>
			</div>
		);
	}

	if (businesses.length === 0) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<Card>
					<CardHeader>
						<CardTitle>No Business Found</CardTitle>
						<CardDescription>Please create a business first to test the AI.</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	const selectedBusiness = selectedBusinessId
		? businesses.find((b) => b._id === selectedBusinessId)
		: null;

	if (!selectedBusiness) {
		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<Card>
					<CardHeader>
						<CardTitle>Select Business to Test</CardTitle>
						<CardDescription>Choose which business to test the AI with.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{businesses.map((business) => (
							<Button
								key={business._id}
								variant="outline"
								className="w-full justify-start"
								onClick={() => setSelectedBusinessId(business._id)}
							>
								{business.name}
							</Button>
						))}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<AITestChat
			businessId={selectedBusiness._id}
			businessName={selectedBusiness.name}
			onBack={() => setSelectedBusinessId(null)}
		/>
	);
}

interface Message {
	role: "user" | "assistant";
	content: string;
	intent?: string;
	language?: string;
	toolsUsed?: string[];
}

type ProcessorMode = "intent" | "agent";

function AITestChat({
	businessId,
	businessName,
	onBack,
}: { businessId: Id<"businesses">; businessName: string; onBack?: () => void }) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
	const [processorMode, setProcessorMode] = useState<ProcessorMode>("agent");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const createConversation = useMutation(api.conversations.create);
	const processMessage = useAction(api.ai.process.processMessage);
	const processWithAgent = useAction(api.ai.agent.processWithAgent);
	const storeCustomerMessage = useMutation(api.conversations.addMessage);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	const handleSend = async () => {
		if (!input.trim() || isLoading) return;

		const userMessage = input.trim();
		setInput("");
		setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
		setIsLoading(true);

		try {
			let activeConversationId = conversationId;

			if (!activeConversationId) {
				activeConversationId = await createConversation({
					businessId,
					customerId: `test-user-${Date.now()}`,
					channel: "whatsapp",
					channelId: `test-channel-${Date.now()}`,
				});
				setConversationId(activeConversationId);
			}

			await storeCustomerMessage({
				conversationId: activeConversationId,
				content: userMessage,
				sender: "customer",
			});

			if (processorMode === "agent") {
				const result = await processWithAgent({
					conversationId: activeConversationId,
					message: userMessage,
				});

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: result.response,
						toolsUsed: result.toolsUsed,
					},
				]);
			} else {
				const result = await processMessage({
					conversationId: activeConversationId,
					message: userMessage,
				});

				setMessages((prev) => [
					...prev,
					{
						role: "assistant",
						content: result.response,
						intent: result.intent.type,
						language: result.detectedLanguage,
					},
				]);
			}
		} catch (error) {
			setMessages((prev) => [
				...prev,
				{
					role: "assistant",
					content: `Error: ${error instanceof Error ? error.message : "Failed to process message"}`,
				},
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleNewConversation = () => {
		setConversationId(null);
		setMessages([]);
	};

	return (
		<div className="container mx-auto max-w-2xl px-4 py-8">
			<Card className="flex h-[80vh] flex-col">
				<CardHeader className="border-b">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>AI Test Chat</CardTitle>
							<CardDescription>
								Testing AI for: <span className="font-medium">{businessName}</span>
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<div className="flex rounded-md border">
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant={processorMode === "agent" ? "default" : "ghost"}
												size="sm"
												onClick={() => setProcessorMode("agent")}
												className="rounded-r-none"
											/>
										}
									>
										<Brain className="mr-1 h-4 w-4" />
										Agent
									</TooltipTrigger>
									<TooltipContent>Agent mode with tools</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												variant={processorMode === "intent" ? "default" : "ghost"}
												size="sm"
												onClick={() => setProcessorMode("intent")}
												className="rounded-l-none"
											/>
										}
									>
										<Cpu className="mr-1 h-4 w-4" />
										Intent
									</TooltipTrigger>
									<TooltipContent>Intent-based mode</TooltipContent>
								</Tooltip>
							</div>
							{onBack && (
								<Button variant="ghost" size="sm" onClick={onBack}>
									Change Business
								</Button>
							)}
							<Button variant="outline" size="sm" onClick={handleNewConversation}>
								New Conversation
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
					{messages.length === 0 && (
						<div className="py-8 text-center text-muted-foreground">
							<p className="mb-2">Start a conversation to test the AI.</p>
							<p className="text-sm">Try messages like:</p>
							<ul className="mt-2 space-y-1 text-sm">
								<li>"Hola" (Spanish greeting)</li>
								<li>"What products do you have?"</li>
								<li>"How much is a Latte?"</li>
								<li>"I want to order a cappuccino"</li>
								<li>"I want to talk to a person" (escalation)</li>
							</ul>
							<p className="mt-4 font-medium text-sm">Checkout Flow (Pickup):</p>
							<ol className="mx-auto mt-2 max-w-xs space-y-1 text-left text-sm">
								<li>1. "I want 2 lattes and a croissant"</li>
								<li>2. "That's all"</li>
								<li>3. "Pickup"</li>
								<li>4. "Cash"</li>
							</ol>
							<p className="mt-4 font-medium text-sm">Checkout Flow (Delivery):</p>
							<ol className="mx-auto mt-2 max-w-xs space-y-1 text-left text-sm">
								<li>1. "I want a cappuccino"</li>
								<li>2. "That's all"</li>
								<li>3. "Delivery"</li>
								<li>4. "123 Main Street, Apt 4B"</li>
								<li>5. "Card"</li>
							</ol>
							<p className="mt-4 font-medium text-sm">Modify During Checkout:</p>
							<ol className="mx-auto mt-2 max-w-xs space-y-1 text-left text-sm">
								<li>1. "I want a latte"</li>
								<li>2. "That's all"</li>
								<li>3. "Delivery"</li>
								<li>4. "Add a croissant" (goes back to ordering)</li>
								<li>5. "That's all" → continue checkout</li>
							</ol>
						</div>
					)}
					{messages.map((msg, i) => (
						<div
							key={i}
							className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
						>
							<div
								className={`max-w-[80%] rounded-lg px-4 py-2 ${
									msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
								}`}
							>
								<p className="whitespace-pre-wrap">{msg.content}</p>
								{msg.intent && (
									<p className="mt-1 text-xs opacity-70">
										Intent: {msg.intent} | Lang: {msg.language}
									</p>
								)}
								{msg.toolsUsed && msg.toolsUsed.length > 0 && (
									<p className="mt-1 text-xs opacity-70">Tools: {msg.toolsUsed.join(", ")}</p>
								)}
							</div>
						</div>
					))}
					{isLoading && (
						<div className="flex justify-start">
							<div className="rounded-lg bg-muted px-4 py-2">
								<p className="text-muted-foreground">Thinking...</p>
							</div>
						</div>
					)}
					<div ref={messagesEndRef} />
				</CardContent>
				<div className="border-t p-4">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSend();
						}}
						className="flex gap-2"
					>
						<Input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Type a message..."
							disabled={isLoading}
							className="flex-1"
						/>
						<Button type="submit" disabled={isLoading || !input.trim()}>
							<Send className="h-4 w-4" />
						</Button>
					</form>
				</div>
			</Card>
		</div>
	);
}
