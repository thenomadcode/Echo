import { createContext, useContext, useEffect, useState } from "react";

const SIDEBAR_COLLAPSED_KEY = "echo:sidebar-collapsed";

interface SidebarContextValue {
	isCollapsed: boolean;
	setIsCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
	const [isCollapsed, setIsCollapsed] = useState(() => {
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
			return stored === "true";
		}
		return false;
	});

	useEffect(() => {
		localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
	}, [isCollapsed]);

	return (
		<SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
			{children}
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider");
	}
	return context;
}
