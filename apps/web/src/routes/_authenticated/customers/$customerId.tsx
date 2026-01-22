import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { customerId } = Route.useParams();

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-bold font-heading mb-6">Customer Details</h1>
      <p className="text-muted-foreground">
        Customer ID: {customerId as Id<"customers">}
      </p>
      <p className="text-muted-foreground mt-2">
        Full detail page coming in S22...
      </p>
    </div>
  );
}
