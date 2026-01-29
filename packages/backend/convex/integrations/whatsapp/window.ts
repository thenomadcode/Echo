// WhatsApp enforces 24h session window: within 24h of customer message = any message type, after = templates only

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function isWithin24HourWindow(lastCustomerMessageAt: number | undefined): boolean {
	if (!lastCustomerMessageAt) {
		return false;
	}
	return Date.now() < lastCustomerMessageAt + TWENTY_FOUR_HOURS_MS;
}

export function getWindowExpiresAt(lastCustomerMessageAt: number | undefined): number | null {
	if (!lastCustomerMessageAt) {
		return null;
	}
	return lastCustomerMessageAt + TWENTY_FOUR_HOURS_MS;
}

export function getWindowRemainingMs(lastCustomerMessageAt: number | undefined): number {
	if (!lastCustomerMessageAt) {
		return 0;
	}
	const remaining = lastCustomerMessageAt + TWENTY_FOUR_HOURS_MS - Date.now();
	return remaining > 0 ? remaining : 0;
}
