import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{
          background: "linear-gradient(135deg, oklch(0.58 0.2 35) 0%, oklch(0.92 0.04 55) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/20 p-2">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white font-heading">Echo</span>
        </div>

        <div className="max-w-md">
          <blockquote className="text-xl text-white/90 italic mb-4">
            "We went from answering 50 messages a day to having Echo handle 500+. Our customers love the instant responses."
          </blockquote>
          <p className="text-white font-medium">— Carlos Rodriguez</p>
          <p className="text-white/70 text-sm">Farmacia Rodriguez, Ciudad de México</p>
        </div>

        <div className="text-white/60 text-sm">
          © 2026 Echo. All rights reserved.
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="rounded-xl bg-primary/10 p-2">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold font-heading">Echo</span>
          </div>
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}
