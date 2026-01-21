import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useQuery } from "convex/react";
import { MessageSquare } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <>
      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AuthLoading>
    </>
  );
}

function RedirectToDashboard() {
  const navigate = useNavigate();
  const businesses = useQuery(api.businesses.list, {});

  useEffect(() => {
    if (businesses !== undefined) {
      if (businesses.length > 0) {
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: "/onboarding" });
      }
    }
  }, [businesses, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen">
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.58 0.2 35) 0%, oklch(0.92 0.04 55) 100%)",
        }}
      >
        <div className="container mx-auto px-6 py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="rounded-xl bg-white/20 p-3">
                <MessageSquare className="h-10 w-10 text-white" />
              </div>
              <span className="text-3xl font-bold text-white font-heading">Echo</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 font-heading leading-tight">
              AI-Powered Customer Service for Your WhatsApp Business
            </h1>

            <p className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl mx-auto">
              Automate customer inquiries, take orders, and provide 24/7 support — all through WhatsApp. Perfect for restaurants, pharmacies, and retail stores in Latin America.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold px-8">
                  Get Started Free
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 font-semibold px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{
            background: "linear-gradient(to top, var(--background), transparent)",
          }}
        />
      </div>
    </div>
  );
}
