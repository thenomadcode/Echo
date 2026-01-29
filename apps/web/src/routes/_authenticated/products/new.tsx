import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBusinessContext } from "@/hooks/use-business-context";

export const Route = createFileRoute("/_authenticated/products/new")({
	component: AddProductPageContent,
});

function AddProductPageContent() {
	const navigate = useNavigate();
	const { activeBusinessId } = useBusinessContext();

	if (!activeBusinessId) {
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
