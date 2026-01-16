import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <Authenticated>
        <div className="container mx-auto max-w-2xl py-8 px-4">
          <h1 className="text-3xl font-bold mb-6">Business Settings</h1>
          <p className="text-muted-foreground">Settings page coming soon...</p>
        </div>
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
