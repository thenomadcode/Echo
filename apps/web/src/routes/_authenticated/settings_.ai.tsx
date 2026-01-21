import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { useEffect } from "react";

import UsageStats from "@/components/ai/usage-stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings_/ai")({
  component: AISettingsContent,
});

function AISettingsContent() {
  const businesses = useQuery(api.businesses.list);

  if (businesses === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  const activeBusiness = businesses[0];

  return <AISettingsForm businessId={activeBusiness._id} />;
}

function AISettingsForm({ businessId }: { businessId: Id<"businesses"> }) {
  const settings = useQuery(api.ai.settings.getSettings, { businessId });
  const updateSettings = useMutation(api.ai.settings.updateSettings);

  const form = useForm({
    defaultValues: {
      aiTone: "",
      aiGreeting: "",
      escalationKeywords: "",
    },
    onSubmit: async ({ value }) => {
      try {
        const keywords = value.escalationKeywords
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0);

        await updateSettings({
          businessId,
          aiTone: value.aiTone || undefined,
          aiGreeting: value.aiGreeting || undefined,
          aiEscalationKeywords: keywords.length > 0 ? keywords : undefined,
        });

        toast.success("AI settings saved successfully");
      } catch (error) {
        toast.error("Failed to save settings");
        console.error(error);
      }
    },
  });

  useEffect(() => {
    if (settings) {
      form.setFieldValue("aiTone", settings.aiTone);
      form.setFieldValue("aiGreeting", settings.aiGreeting);
      form.setFieldValue("escalationKeywords", settings.aiEscalationKeywords.join(", "));
    }
  }, [settings, form]);

  if (settings === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI Settings</h1>
        <p className="text-muted-foreground">Configure your AI assistant behavior</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Personality</CardTitle>
              <CardDescription>
                Customize how your AI assistant communicates with customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form.Field name="aiTone">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="aiTone">AI Tone / Personality</Label>
                    <Input
                      id="aiTone"
                      placeholder="e.g., friendly and professional, casual, formal"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Describe the tone you want your AI to use when responding to customers
                    </p>
                  </div>
                )}
              </form.Field>

              <form.Field name="aiGreeting">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="aiGreeting">Custom Greeting Message</Label>
                    <Textarea
                      id="aiGreeting"
                      placeholder="e.g., Hello! Welcome to our store. How can I help you today?"
                      rows={3}
                      value={field.state.value}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => field.handleChange(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      The greeting message shown when a customer starts a conversation
                    </p>
                  </div>
                )}
              </form.Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Escalation Settings</CardTitle>
              <CardDescription>
                Configure when conversations should be escalated to humans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form.Field name="escalationKeywords">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="escalationKeywords">Escalation Keywords</Label>
                    <Input
                      id="escalationKeywords"
                      placeholder="e.g., urgent, complaint, refund, manager"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Comma-separated keywords that will trigger escalation to a human agent
                    </p>
                  </div>
                )}
              </form.Field>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full">
            Save Settings
          </Button>

          <UsageStats businessId={businessId} />
        </div>
      </form>
    </div>
  );
}
