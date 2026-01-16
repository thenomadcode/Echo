import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated, useMutation } from "convex/react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function OnboardingPage() {
  return (
    <>
      <Authenticated>
        <OnboardingForm />
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

function OnboardingForm() {
  const navigate = useNavigate();
  const createBusiness = useMutation(api.businesses.create);
  const [slugPreview, setSlugPreview] = useState("");

  const businessSchema = z.object({
    name: z.string().min(2, "Business name must be at least 2 characters"),
    type: z.enum(["restaurant", "pharmacy", "retail", "other"]),
    description: z.string(),
    logoUrl: z.string(),
    address: z.string(),
  });

  const form = useForm({
    defaultValues: {
      name: "",
      type: "restaurant" as "restaurant" | "pharmacy" | "retail" | "other",
      description: "",
      logoUrl: "",
      address: "",
    },
    onSubmit: async ({ value }) => {
      const validated = businessSchema.parse(value);
      const logoUrlValue = validated.logoUrl.trim();
      
      try {
        if (logoUrlValue && !z.string().url().safeParse(logoUrlValue).success) {
          toast.error("Invalid logo URL");
          return;
        }
        
        await createBusiness({
          name: validated.name,
          type: validated.type,
          description: validated.description || undefined,
          logoUrl: logoUrlValue || undefined,
          address: validated.address || undefined,
        });
        toast.success("Business created successfully!");
        navigate({ to: "/dashboard" });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to create business");
      }
    },
  });

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center justify-center">
          <div className="flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              1
            </div>
            <span className="ml-2 text-sm font-medium">Create Your Business</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome to Echo</CardTitle>
          <CardDescription>
            Let's set up your business profile. This will help us personalize your experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <div>
              <form.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>
                      Business Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                        setSlugPreview(generateSlug(e.target.value));
                      }}
                      placeholder="My Awesome Business"
                    />
                    {field.state.meta.errors.length > 0 &&
                      field.state.meta.errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-500">
                          {String(error)}
                        </p>
                      ))}
                    {slugPreview && (
                      <p className="text-sm text-muted-foreground">
                        Your business URL will be: <span className="font-mono">{slugPreview}</span>
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="type">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>
                      Business Type <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(
                          e.target.value as "restaurant" | "pharmacy" | "retail" | "other",
                        )
                      }
                      onBlur={field.handleBlur}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="restaurant">Restaurant</option>
                      <option value="pharmacy">Pharmacy</option>
                      <option value="retail">Retail</option>
                      <option value="other">Other</option>
                    </select>
                    {field.state.meta.errors.length > 0 &&
                      field.state.meta.errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-500">
                          {String(error)}
                        </p>
                      ))}
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
                      placeholder="Brief description of your business"
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {field.state.meta.errors.length > 0 &&
                      field.state.meta.errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-500">
                          {String(error)}
                        </p>
                      ))}
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
                    {field.state.meta.errors.length > 0 &&
                      field.state.meta.errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-500">
                          {String(error)}
                        </p>
                      ))}
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="address">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Address</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="123 Main St, City, Country"
                    />
                    {field.state.meta.errors.length > 0 &&
                      field.state.meta.errors.map((error, i) => (
                        <p key={i} className="text-sm text-red-500">
                          {String(error)}
                        </p>
                      ))}
                  </div>
                )}
              </form.Field>
            </div>

            <form.Subscribe>
              {(state) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!state.canSubmit || state.isSubmitting}
                >
                  {state.isSubmitting ? "Creating..." : "Create Business"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
