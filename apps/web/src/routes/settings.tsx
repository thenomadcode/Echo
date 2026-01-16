import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { useEffect } from "react";

import SignInForm from "@/components/sign-in-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

function SettingsPage() {
  return (
    <>
      <Authenticated>
        <SettingsContent />
      </Authenticated>
      <Unauthenticated>
        <div className="mx-auto mt-10 max-w-md p-6">
          <SignInForm onSwitchToSignUp={() => {}} />
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

function SettingsContent() {
  const navigate = useNavigate();
  const businesses = useQuery(api.businesses.list);
  const updateBusiness = useMutation(api.businesses.update);

  useEffect(() => {
    if (businesses !== undefined && businesses.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [businesses, navigate]);

  if (businesses === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return null;
  }

  const activeBusiness = businesses[0];

  return <SettingsForm business={activeBusiness} updateBusiness={updateBusiness} />;
}

interface Business {
  _id: Id<"businesses">;
  name: string;
  description?: string;
  logoUrl?: string;
  defaultLanguage: string;
  timezone: string;
  businessHours?: {
    open: string;
    close: string;
    days: number[];
  };
  aiGreeting?: string;
}

function SettingsForm({
  business,
  updateBusiness,
}: {
  business: Business;
  updateBusiness: (args: {
    businessId: Id<"businesses">;
    name?: string;
    description?: string;
    logoUrl?: string;
    defaultLanguage?: string;
    timezone?: string;
    businessHours?: { open: string; close: string; days: number[] };
    aiGreeting?: string;
  }) => Promise<string>;
}) {
  const form = useForm({
    defaultValues: {
      name: business.name,
      description: business.description || "",
      logoUrl: business.logoUrl || "",
      defaultLanguage: business.defaultLanguage,
      timezone: business.timezone,
      hoursOpen: business.businessHours?.open || "09:00",
      hoursClose: business.businessHours?.close || "17:00",
      hoursDays: business.businessHours?.days || [],
      aiGreeting: business.aiGreeting || "",
    },
    onSubmit: async ({ value }) => {
      try {
        const updates: {
          businessId: Id<"businesses">;
          name?: string;
          description?: string;
          logoUrl?: string;
          defaultLanguage?: string;
          timezone?: string;
          businessHours?: { open: string; close: string; days: number[] };
          aiGreeting?: string;
        } = {
          businessId: business._id,
        };

        if (value.name !== business.name) {
          updates.name = value.name;
        }
        if (value.description !== (business.description || "")) {
          updates.description = value.description || undefined;
        }
        if (value.logoUrl !== (business.logoUrl || "")) {
          updates.logoUrl = value.logoUrl || undefined;
        }
        if (value.defaultLanguage !== business.defaultLanguage) {
          updates.defaultLanguage = value.defaultLanguage;
        }
        if (value.timezone !== business.timezone) {
          updates.timezone = value.timezone;
        }
        if (
          value.hoursOpen !== (business.businessHours?.open || "09:00") ||
          value.hoursClose !== (business.businessHours?.close || "17:00") ||
          JSON.stringify(value.hoursDays) !== JSON.stringify(business.businessHours?.days || [])
        ) {
          updates.businessHours = {
            open: value.hoursOpen,
            close: value.hoursClose,
            days: value.hoursDays,
          };
        }
        if (value.aiGreeting !== (business.aiGreeting || "")) {
          updates.aiGreeting = value.aiGreeting || undefined;
        }

        await updateBusiness(updates);
        toast.success("Settings saved successfully!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save settings");
      }
    },
  });

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Business Settings</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Update your business profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <form.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Business Name</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="description">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Description</Label>
                    <textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="logoUrl">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Logo URL</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="url"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Localization</CardTitle>
            <CardDescription>Set your default language and timezone</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <form.Field name="defaultLanguage">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Default Language</Label>
                    <select
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish (Español)</option>
                      <option value="pt">Portuguese (Português)</option>
                    </select>
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="timezone">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Timezone</Label>
                    <select
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Hours</CardTitle>
            <CardDescription>Set your operating hours and days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <form.Field name="hoursOpen">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Open Time</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="time"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                </form.Field>
              </div>

              <div>
                <form.Field name="hoursClose">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Close Time</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="time"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>

            <div>
              <form.Field name="hoursDays">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Operating Days</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {DAYS_OF_WEEK.map((day) => (
                        <label key={day.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={field.state.value.includes(Number(day.value))}
                            onChange={(e) => {
                              const dayNum = Number(day.value);
                              if (e.target.checked) {
                                field.handleChange([...field.state.value, dayNum].sort());
                              } else {
                                field.handleChange(
                                  field.state.value.filter((d: number) => d !== dayNum),
                                );
                              }
                            }}
                            className="h-4 w-4 rounded border-input"
                          />
                          <span className="text-sm">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
            <CardDescription>Customize your AI assistant greeting</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <form.Field name="aiGreeting">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>AI Greeting Message</Label>
                    <textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      rows={4}
                      placeholder="Hello! Welcome to our business. How can I help you today?"
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <form.Subscribe>
            {(state) => (
              <Button type="submit" disabled={!state.canSubmit || state.isSubmitting}>
                {state.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}
