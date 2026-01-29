import { useEffect, useState } from "react";

/**
 * Debounces a value by delaying updates until after a specified delay.
 * Useful for search inputs, autocomplete, and other frequently changing values.
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const [searchTerm, setSearchTerm] = useState("");
 *   const debouncedSearch = useDebounce(searchTerm, 300);
 *
 *   useEffect(() => {
 *     // Only runs 300ms after user stops typing
 *     if (debouncedSearch) {
 *       performSearch(debouncedSearch);
 *     }
 *   }, [debouncedSearch]);
 *
 *   return <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />;
 * }
 * ```
 */

export function useDebounce<T>(value: T, delay = 500): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(handler);
		};
	}, [value, delay]);

	return debouncedValue;
}
