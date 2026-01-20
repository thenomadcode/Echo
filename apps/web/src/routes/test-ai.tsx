import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery, useAction } from "convex/react";
import { useState, useRef, useEffect } from "react";
import { Send, Cpu, Brain } from "lucide-react";

import SignInForm from "@/components/sign-in-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
        <div className="flex items-center justify-center min-h-screen">
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
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
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
    ? businesses.find(b => b._id === selectedBusinessId) 
    : null;

  if (!selectedBusiness) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
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

function AITestChat({ businessId, businessName, onBack }: { businessId: Id<"businesses">; businessName: string; onBack?: () => void }) {
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
          customerId: "test-user-" + Date.now(),
          channel: "test",
          channelId: "test-channel-" + Date.now(),
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
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <Card className="h-[80vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Test Chat</CardTitle>
              <CardDescription>
                Testing AI for: <span className="font-medium">{businessName}</span>
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex border rounded-md">
                <Button
                  variant={processorMode === "agent" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setProcessorMode("agent")}
                  className="rounded-r-none"
                  title="Agent mode with tools"
                >
                  <Brain className="h-4 w-4 mr-1" />
                  Agent
                </Button>
                <Button
                  variant={processorMode === "intent" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setProcessorMode("intent")}
                  className="rounded-l-none"
                  title="Intent-based mode"
                >
                  <Cpu className="h-4 w-4 mr-1" />
                  Intent
                </Button>
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
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p className="mb-2">Start a conversation to test the AI.</p>
              <p className="text-sm">Try messages like:</p>
              <ul className="text-sm mt-2 space-y-1">
                <li>"Hola" (Spanish greeting)</li>
                <li>"What products do you have?"</li>
                <li>"How much is a Latte?"</li>
                <li>"I want to order a cappuccino"</li>
                <li>"I want to talk to a person" (escalation)</li>
              </ul>
              <p className="text-sm mt-4 font-medium">Checkout Flow (Pickup):</p>
              <ol className="text-sm mt-2 space-y-1 text-left max-w-xs mx-auto">
                <li>1. "I want 2 lattes and a croissant"</li>
                <li>2. "That's all"</li>
                <li>3. "Pickup"</li>
                <li>4. "Cash"</li>
              </ol>
              <p className="text-sm mt-4 font-medium">Checkout Flow (Delivery):</p>
              <ol className="text-sm mt-2 space-y-1 text-left max-w-xs mx-auto">
                <li>1. "I want a cappuccino"</li>
                <li>2. "That's all"</li>
                <li>3. "Delivery"</li>
                <li>4. "123 Main Street, Apt 4B"</li>
                <li>5. "Card"</li>
              </ol>
              <p className="text-sm mt-4 font-medium">Modify During Checkout:</p>
              <ol className="text-sm mt-2 space-y-1 text-left max-w-xs mx-auto">
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
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.intent && (
                  <p className="text-xs mt-1 opacity-70">
                    Intent: {msg.intent} | Lang: {msg.language}
                  </p>
                )}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <p className="text-xs mt-1 opacity-70">
                    Tools: {msg.toolsUsed.join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
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
