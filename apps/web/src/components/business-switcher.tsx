import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { api } from "@echo/backend/convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Check, ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBusinessContext } from "@/hooks/use-business-context";

export function BusinessSwitcher() {
	const navigate = useNavigate();
	const businesses = useQuery(api.businesses.list);
	const { activeBusinessId, setActiveBusinessId } = useBusinessContext();

	if (!businesses || businesses.length === 0) {
		return null;
	}

	const activeBusiness = businesses.find((b) => b._id === activeBusinessId) || businesses[0];

	const handleBusinessSwitch = (businessId: Id<"businesses">) => {
		setActiveBusinessId(businessId);
	};

	const handleCreateNew = () => {
		navigate({ to: "/onboarding" });
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={(props) => (
					<Button {...props} variant="outline" className="flex items-center gap-2">
						<span className="font-medium">{activeBusiness.name}</span>
						<ChevronDown className="h-4 w-4 opacity-50" />
					</Button>
				)}
			/>
			<DropdownMenuContent align="end" className="w-64">
				{businesses.map((business) => (
					<DropdownMenuItem
						key={business._id}
						onClick={() => handleBusinessSwitch(business._id)}
						className="flex cursor-pointer items-center justify-between"
					>
						<div className="flex flex-col">
							<span className="font-medium">{business.name}</span>
							<span className="text-muted-foreground text-xs">
								{business.type.charAt(0).toUpperCase() + business.type.slice(1)}
							</span>
						</div>
						{business._id === activeBusinessId && <Check className="h-4 w-4" />}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleCreateNew} className="cursor-pointer">
					<Plus className="mr-2 h-4 w-4" />
					<span>Create new business</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
