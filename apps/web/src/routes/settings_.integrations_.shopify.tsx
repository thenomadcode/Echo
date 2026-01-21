import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/settings_/integrations_/shopify")({
  component: ShopifySettingsPage,
});

function ShopifySettingsPage() {
  return (
    <>
      <Authenticated>
        <div className="flex items-center justify-center min-h-screen">
          <div>Shopify Settings - Coming in S08</div>
        </div>
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
