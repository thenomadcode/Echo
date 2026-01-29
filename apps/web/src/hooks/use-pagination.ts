import { useMemo, useState } from "react";

/**
 * Manages pagination state with computed values and navigation handlers.
 *
 * @example
 * ```tsx
 * function ProductList({ items }) {
 *   const pagination = usePagination({
 *     totalItems: items.length,
 *     itemsPerPage: 10,
 *   });
 *
 *   const visibleItems = items.slice(
 *     pagination.startIndex,
 *     pagination.endIndex
 *   );
 *
 *   return (
 *     <div>
 *       {visibleItems.map(item => <ProductCard key={item.id} {...item} />)}
 *       <div>
 *         <button onClick={pagination.goToPrevious} disabled={!pagination.hasPrevious}>
 *           Previous
 *         </button>
 *         <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
 *         <button onClick={pagination.goToNext} disabled={!pagination.hasNext}>
 *           Next
 *         </button>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */

interface UsePaginationOptions {
	totalItems: number;
	itemsPerPage: number;
	initialPage?: number;
}

interface UsePaginationReturn {
	currentPage: number;
	totalPages: number;
	startIndex: number;
	endIndex: number;
	hasPrevious: boolean;
	hasNext: boolean;
	goToPage: (page: number) => void;
	goToNext: () => void;
	goToPrevious: () => void;
	goToFirst: () => void;
	goToLast: () => void;
}

export function usePagination({
	totalItems,
	itemsPerPage,
	initialPage = 1,
}: UsePaginationOptions): UsePaginationReturn {
	const [currentPage, setCurrentPage] = useState(initialPage);

	const totalPages = Math.ceil(totalItems / itemsPerPage);

	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

	const hasPrevious = currentPage > 1;
	const hasNext = currentPage < totalPages;

	const goToPage = (page: number) => {
		const safeePage = Math.max(1, Math.min(page, totalPages));
		setCurrentPage(safeePage);
	};

	const goToNext = () => {
		if (hasNext) {
			setCurrentPage(currentPage + 1);
		}
	};

	const goToPrevious = () => {
		if (hasPrevious) {
			setCurrentPage(currentPage - 1);
		}
	};

	const goToFirst = () => {
		setCurrentPage(1);
	};

	const goToLast = () => {
		setCurrentPage(totalPages);
	};

	return useMemo(
		() => ({
			currentPage,
			totalPages,
			startIndex,
			endIndex,
			hasPrevious,
			hasNext,
			goToPage,
			goToNext,
			goToPrevious,
			goToFirst,
			goToLast,
		}),
		[currentPage, totalPages, startIndex, endIndex, hasPrevious, hasNext],
	);
}
