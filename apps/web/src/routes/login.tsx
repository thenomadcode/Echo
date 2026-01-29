import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import { SignInForm } from "@/components/sign-in-form";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	return (
		<div className="flex min-h-screen">
			<div
				className="hidden flex-col justify-between p-12 lg:flex lg:w-1/2"
				style={{
					background: "linear-gradient(135deg, oklch(0.58 0.2 35) 0%, oklch(0.92 0.04 55) 100%)",
				}}
			>
				<div className="flex items-center gap-3">
					<div className="rounded-xl bg-white/20 p-2">
						<MessageSquare className="h-6 w-6 text-white" />
					</div>
					<span className="font-bold font-heading text-white text-xl">Echo</span>
				</div>

				<div className="max-w-md">
					<blockquote className="mb-4 text-white/90 text-xl italic">
						"Echo transformed how we handle customer inquiries. We can now serve 3x more customers
						without hiring additional staff."
					</blockquote>
					<p className="font-medium text-white">— Maria Santos</p>
					<p className="text-sm text-white/70">Owner, La Cocina de Maria, Bogotá</p>
				</div>

				<div className="text-sm text-white/60">© 2026 Echo. All rights reserved.</div>
			</div>

			<div className="flex w-full items-center justify-center p-6 lg:w-1/2">
				<div className="w-full max-w-md">
					<div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
						<div className="rounded-xl bg-primary/10 p-2">
							<MessageSquare className="h-6 w-6 text-primary" />
						</div>
						<span className="font-bold font-heading text-xl">Echo</span>
					</div>
					<SignInForm />
				</div>
			</div>
		</div>
	);
}
