/**
 * Shared formatting utilities for currency, dates, and times across the application.
 *
 * Currency amounts are stored in smallest units (cents/centavos) as integers.
 * Dates/times are stored as Unix timestamps (milliseconds since epoch).
 */

type Currency = "COP" | "BRL" | "MXN" | "USD";

/**
 * Maps currency codes to their locale identifiers for number formatting.
 */
export const CURRENCY_LOCALES: Record<Currency, string> = {
	COP: "es-CO", // Colombian Peso
	BRL: "pt-BR", // Brazilian Real
	MXN: "es-MX", // Mexican Peso
	USD: "en-US", // US Dollar
};

/**
 * Maps currency codes to their display symbols.
 */
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
	COP: "$",
	BRL: "R$",
	MXN: "$",
	USD: "$",
};

/**
 * Formats a currency amount (in cents) to a localized string with currency symbol.
 *
 * @param amountInCents - Amount in smallest currency unit (e.g., cents, centavos)
 * @param currency - Currency code (COP, BRL, MXN, USD)
 * @returns Formatted currency string (e.g., "$1,234.56" for USD)
 *
 * @example
 * formatCurrency(123456, "USD") // "$1,234.56"
 * formatCurrency(123456, "COP") // "$1.234,56"
 * formatCurrency(123456, "BRL") // "R$ 1.234,56"
 */
export function formatCurrency(amountInCents: number, currency: Currency = "USD"): string {
	const amountInMajorUnits = amountInCents / 100;
	const locale = CURRENCY_LOCALES[currency];

	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
	}).format(amountInMajorUnits);
}

/**
 * Formats a Unix timestamp to a localized date string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale identifier (defaults to "en-US")
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @returns Formatted date string
 *
 * @example
 * formatDate(Date.now(), "en-US", { month: "short", day: "numeric" }) // "Jan 28"
 * formatDate(Date.now(), "en-US") // "1/28/2026"
 */
export function formatDate(
	timestamp: number,
	locale = "en-US",
	options?: Intl.DateTimeFormatOptions,
): string {
	const date = new Date(timestamp);
	const defaultOptions: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "short",
		day: "numeric",
	};

	return date.toLocaleDateString(locale, options || defaultOptions);
}

/**
 * Formats a Unix timestamp to a localized date and time string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale identifier (defaults to "en-US")
 * @returns Formatted date and time string
 *
 * @example
 * formatDateTime(Date.now()) // "Jan 28, 2026, 3:45 PM"
 */
export function formatDateTime(timestamp: number, locale = "en-US"): string {
	const date = new Date(timestamp);

	return date.toLocaleString(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/**
 * Formats a Unix timestamp to a relative time string (e.g., "2m ago", "Just now").
 *
 * For times less than 24 hours ago, shows relative time.
 * For older times, shows absolute time (hour:minute).
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime(Date.now() - 120000) // "2m ago"
 * formatRelativeTime(Date.now() - 7200000) // "2h ago"
 * formatRelativeTime(Date.now() - 86400000) // "03:45 PM" (if beyond 24h)
 */
export function formatRelativeTime(timestamp: number): string {
	const now = new Date();
	const date = new Date(timestamp);
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;

	// For times beyond 24 hours, show absolute time
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
