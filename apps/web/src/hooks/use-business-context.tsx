import type { Id } from "@echo/backend/convex/_generated/dataModel";
import { createContext, useContext, useEffect, useState } from "react";

/**
 * Business context for managing active business state across the app.
 *
 * This context provides:
 * - Active business ID with localStorage persistence
 * - Automatic sync when business list changes
 * - Currency and timezone from business settings (future: can be extended)
 *
 * @example
 * ```tsx
 * // Wrap your app with the provider
 * <BusinessProvider businesses={businesses}>
 *   <YourApp />
 * </BusinessProvider>
 *
 * // Use in components
 * function MyComponent() {
 *   const { activeBusinessId, setActiveBusinessId } = useBusinessContext();
 *   return <div>Current business: {activeBusinessId}</div>;
 * }
 * ```
 */

const ACTIVE_BUSINESS_KEY = "echo:activeBusinessId";

interface BusinessContextValue {
	/** Currently active business ID */
	activeBusinessId: Id<"businesses"> | null;
	/** Set the active business ID (persists to localStorage) */
	setActiveBusinessId: (id: Id<"businesses">) => void;
	/** Current business currency (defaults to "USD" if not set) */
	currency: string;
	/** Current business timezone (defaults to "UTC" if not set) */
	timezone: string;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

interface Business {
	_id: Id<"businesses">;
	name: string;
	currency?: string;
	timezone?: string;
}

interface BusinessProviderProps {
	children: React.ReactNode;
	businesses: Business[] | undefined;
}

/**
 * Provider component for business context.
 * Handles localStorage sync and automatic fallback to first business.
 */
export function BusinessProvider({ children, businesses }: BusinessProviderProps) {
	const [activeBusinessId, setActiveBusinessIdState] = useState<Id<"businesses"> | null>(() => {
		if (typeof window === "undefined") return null;
		const stored = localStorage.getItem(ACTIVE_BUSINESS_KEY);
		return stored as Id<"businesses"> | null;
	});

	// Auto-select first business if none selected or selected one doesn't exist
	useEffect(() => {
		if (!businesses || businesses.length === 0) return;

		if (!activeBusinessId || !businesses.find((b) => b._id === activeBusinessId)) {
			setActiveBusinessIdState(businesses[0]._id);
			localStorage.setItem(ACTIVE_BUSINESS_KEY, businesses[0]._id);
		}
	}, [businesses, activeBusinessId]);

	const setActiveBusinessId = (id: Id<"businesses">) => {
		setActiveBusinessIdState(id);
		localStorage.setItem(ACTIVE_BUSINESS_KEY, id);
	};

	// Get business settings
	const activeBusiness = businesses?.find((b) => b._id === activeBusinessId);
	const currency = activeBusiness?.currency || "USD";
	const timezone = activeBusiness?.timezone || "UTC";

	return (
		<BusinessContext.Provider
			value={{
				activeBusinessId,
				setActiveBusinessId,
				currency,
				timezone,
			}}
		>
			{children}
		</BusinessContext.Provider>
	);
}

/**
 * Hook to access business context.
 * Throws error if used outside BusinessProvider.
 *
 * @returns Business context value with activeBusinessId, setActiveBusinessId, currency, timezone
 */
export function useBusinessContext() {
	const context = useContext(BusinessContext);
	if (!context) {
		throw new Error("useBusinessContext must be used within BusinessProvider");
	}
	return context;
}
