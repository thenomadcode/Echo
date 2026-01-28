import { api } from "@echo/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";

import CategoryManager from "@/components/products/category-manager";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/products/categories")({
	component: CategoriesContent,
});

function CategoriesContent() {
	const navigate = useNavigate();
	const businesses = useQuery(api.businesses.list);

	if (businesses === undefined) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (businesses.length === 0) {
		return null;
	}

	const activeBusiness = businesses[0];

	return (
		<div className="container mx-auto max-w-4xl px-4 py-8">
			<div className="mb-6">
				<Button variant="ghost" onClick={() => navigate({ to: "/products" })} className="mb-4">
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Products
				</Button>
				<h1 className="font-bold text-3xl">Manage Categories</h1>
				<p className="mt-2 text-muted-foreground">Organize your products into categories</p>
			</div>

			<CategoryManager businessId={activeBusiness._id} />
		</div>
	);
}
