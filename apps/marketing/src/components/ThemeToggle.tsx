import { type ReactNode, useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "echo-theme";

function getSystemTheme(): "light" | "dark" {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
	const root = document.documentElement;
	const effectiveTheme = theme === "system" ? getSystemTheme() : theme;

	if (effectiveTheme === "dark") {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
}

export function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("system");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "system" || stored === "light" || stored === "dark") {
			setTheme(stored);
			applyTheme(stored);
		}

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			const current = localStorage.getItem(STORAGE_KEY);
			if (!current || current === "system") {
				applyTheme("system");
			}
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	const cycleTheme = () => {
		const order: Theme[] = ["system", "light", "dark"];
		const currentIndex = order.indexOf(theme);
		const nextTheme = order[(currentIndex + 1) % order.length] as Theme;

		setTheme(nextTheme);
		localStorage.setItem(STORAGE_KEY, nextTheme);
		applyTheme(nextTheme);
	};

	if (!mounted) {
		return (
			<button
				type="button"
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "36px",
					height: "36px",
					borderRadius: "6px",
					border: "none",
					background: "transparent",
					cursor: "pointer",
				}}
				aria-label="Toggle theme"
			>
				<svg
					style={{ width: "20px", height: "20px", color: "#78716C" }}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
					/>
				</svg>
			</button>
		);
	}

	const icons = {
		system: (
			<svg
				style={{ width: "20px", height: "20px" }}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		),
		light: (
			<svg
				style={{ width: "20px", height: "20px" }}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
				/>
			</svg>
		),
		dark: (
			<svg
				style={{ width: "20px", height: "20px" }}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
				/>
			</svg>
		),
	};

	const labels = {
		system: "System theme",
		light: "Light theme",
		dark: "Dark theme",
	};

	return (
		<button
			type="button"
			onClick={cycleTheme}
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: "36px",
				height: "36px",
				borderRadius: "6px",
				border: "none",
				background: "transparent",
				cursor: "pointer",
				color: "var(--color-muted-foreground)",
				transition: "color 0.2s",
			}}
			aria-label={labels[theme]}
			title={labels[theme]}
		>
			{icons[theme]}
		</button>
	);
}

export function ThemeToggleMobile() {
	const [theme, setTheme] = useState<Theme>("system");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "system" || stored === "light" || stored === "dark") {
			setTheme(stored);
		}
	}, []);

	const selectTheme = (newTheme: Theme) => {
		setTheme(newTheme);
		localStorage.setItem(STORAGE_KEY, newTheme);
		applyTheme(newTheme);
	};

	if (!mounted) return null;

	const options: { value: Theme; label: string; icon: ReactNode }[] = [
		{
			value: "system",
			label: "System",
			icon: (
				<svg
					style={{ width: "16px", height: "16px" }}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					/>
				</svg>
			),
		},
		{
			value: "light",
			label: "Light",
			icon: (
				<svg
					style={{ width: "16px", height: "16px" }}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
					/>
				</svg>
			),
		},
		{
			value: "dark",
			label: "Dark",
			icon: (
				<svg
					style={{ width: "16px", height: "16px" }}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
					/>
				</svg>
			),
		},
	];

	return (
		<div style={{ padding: "0 12px" }}>
			<p
				style={{
					fontSize: "12px",
					fontWeight: 500,
					color: "#78716C",
					marginBottom: "8px",
					textTransform: "uppercase",
					letterSpacing: "0.05em",
				}}
			>
				Theme
			</p>
			<div style={{ display: "flex", gap: "8px" }}>
				{options.map((option) => (
					<button
						key={option.value}
						type="button"
						onClick={() => selectTheme(option.value)}
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "4px",
							padding: "8px",
							borderRadius: "6px",
							border: theme === option.value ? "2px solid #EA580C" : "1px solid #E7E5E4",
							background: theme === option.value ? "rgba(234, 88, 12, 0.1)" : "transparent",
							cursor: "pointer",
							color: theme === option.value ? "#EA580C" : "#1C1917",
							fontSize: "12px",
							fontWeight: 500,
						}}
					>
						{option.icon}
						{option.label}
					</button>
				))}
			</div>
		</div>
	);
}

export default ThemeToggle;
