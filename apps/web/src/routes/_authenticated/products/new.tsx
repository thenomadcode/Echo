import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { ProductForm } from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/products/new")({
	component: AddProductPageContent,
});

function AddProductPageContent() {
	const navigate = useNavigate();
	const businesses = useQuery(api.businesses.list, {});

	const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

	useEffect(() => {
		if (businesses === undefined) return;

		if (businesses.length === 0) {
			navigate({ to: "/onboarding" });
			return;
		}

		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("echo:activeBusinessId");
			if (stored && businesses.find((b) => b._id === stored)) {
				setActiveBusinessId(stored);
			} else {
				setActiveBusinessId(businesses[0]?._id || null);
			}
		}
	}, [businesses, navigate]);

	if (businesses === undefined || !activeBusinessId) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	const handleSuccess = () => {
		navigate({ to: "/products" });
	};

	return (
		<div className="container mx-auto max-w-4xl p-6">
			<div className="mb-4">
				<Button variant="ghost" size="sm" onClick={() => navigate({ to: "/products" })}>
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Products
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Add New Product</CardTitle>
				</CardHeader>
				<CardContent>
					<ProductForm mode="create" businessId={activeBusinessId} onSuccess={handleSuccess} />
				</CardContent>
			</Card>
		</div>
	);
}
