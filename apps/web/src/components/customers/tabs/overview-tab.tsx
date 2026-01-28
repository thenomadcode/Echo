import type { Id } from "@echo/backend/convex/_generated/dataModel";

import { AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AddressesSection } from "../sections/addresses-section";

export interface CustomerContext {
	profile: {
		name?: string;
		phone: string;
		preferredLanguage?: string;
		firstSeenAt: number;
		lastSeenAt: number;
		totalOrders: number;
		totalSpent: number;
	};
	addresses: Array<{ label: string; address: string; isDefault: boolean }>;
	memory: {
		allergies: string[];
		restrictions: string[];
		preferences: string[];
		behaviors: string[];
	};
	businessNotes: string;
}

export interface OverviewTabProps {
	customer: {
		_id: Id<"customers">;
		name?: string;
		phone: string;
		totalOrders: number;
		totalSpent: number;
		firstSeenAt: number;
		lastSeenAt: number;
		preferredLanguage?: string;
	};
	context: CustomerContext | null | undefined;
	formatCurrency: (amountInCents: number, currency?: "COP" | "BRL" | "MXN" | "USD") => string;
	formatDate: (timestamp: number) => string;
}

export function OverviewTab({ customer, context, formatCurrency, formatDate }: OverviewTabProps) {
	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Quick Stats</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex justify-between">
							<span className="text-muted-foreground">First Seen</span>
							<span>{formatDate(customer.firstSeenAt)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Last Seen</span>
							<span>{formatDate(customer.lastSeenAt)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Average Order</span>
							<span>
								{customer.totalOrders > 0
									? formatCurrency(Math.round(customer.totalSpent / customer.totalOrders))
									: "-"}
							</span>
						</div>
						{customer.preferredLanguage && (
							<div className="flex justify-between">
								<span className="text-muted-foreground">Preferred Language</span>
								<span className="capitalize">{customer.preferredLanguage}</span>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<AddressesSection customerId={customer._id} />

			{context?.memory?.allergies && context.memory.allergies.length > 0 && (
				<Card className="border-red-200 dark:border-red-900">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
							<AlertCircle className="h-4 w-4" />
							Allergies
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-2">
							{context.memory.allergies.map((allergy, idx) => (
								<Badge key={idx} variant="destructive">
									{allergy}
								</Badge>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{context &&
				(context.memory?.preferences?.length > 0 || context.memory?.restrictions?.length > 0) && (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Key Preferences</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{context.memory.restrictions.length > 0 && (
									<div>
										<p className="mb-1 font-medium text-orange-600 text-sm dark:text-orange-400">
											Restrictions
										</p>
										<div className="flex flex-wrap gap-1">
											{context.memory.restrictions.map((r, idx) => (
												<Badge key={idx} variant="warning" className="text-xs">
													{r}
												</Badge>
											))}
										</div>
									</div>
								)}
								{context.memory.preferences.length > 0 && (
									<div>
										<p className="mb-1 font-medium text-blue-600 text-sm dark:text-blue-400">
											Preferences
										</p>
										<div className="flex flex-wrap gap-1">
											{context.memory.preferences.map((p, idx) => (
												<Badge key={idx} variant="info" className="text-xs">
													{p}
												</Badge>
											))}
										</div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				)}

			{context?.businessNotes && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Business Notes</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="whitespace-pre-wrap text-sm">{context.businessNotes}</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
