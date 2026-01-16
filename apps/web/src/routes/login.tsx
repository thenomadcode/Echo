import { createFileRoute, useNavigate } from "@tanstack/react-router";

import SignInForm from "@/components/sign-in-form";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const handleSwitchToSignUp = () => {
    navigate({ to: "/signup" });
  };

  return <SignInForm onSwitchToSignUp={handleSwitchToSignUp} />;
}
