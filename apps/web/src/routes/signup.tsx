import { createFileRoute, useNavigate } from "@tanstack/react-router";

import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();

  const handleSwitchToSignIn = () => {
    navigate({ to: "/login" });
  };

  return <SignUpForm onSwitchToSignIn={handleSwitchToSignIn} />;
}
