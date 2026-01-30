/**
 * Utility functions for generating product variant combinations from option values.
 * Supports Shopify-compatible 3-option limit.
 */

export interface VariantOption {
	name: string;
	values: string[];
}

export interface GeneratedVariant {
	name: string;
	option1Name?: string;
	option1Value?: string;
	option2Name?: string;
	option2Value?: string;
	option3Name?: string;
	option3Value?: string;
}

/**
 * Generate all variant combinations from 1-3 options.
 *
 * @param options - Array of 1-3 options with names and values
 * @returns Array of variant combinations with auto-generated names
 *
 * @example
 * // Single option
 * generateVariantCombinations([
 *   { name: 'Size', values: ['Small', 'Medium', 'Large'] }
 * ])
 * // Returns: [
 * //   { name: 'Small', option1Name: 'Size', option1Value: 'Small' },
 * //   { name: 'Medium', option1Name: 'Size', option1Value: 'Medium' },
 * //   { name: 'Large', option1Name: 'Size', option1Value: 'Large' }
 * // ]
 *
 * @example
 * // Multiple options
 * generateVariantCombinations([
 *   { name: 'Size', values: ['Small', 'Large'] },
 *   { name: 'Color', values: ['Red', 'Blue'] }
 * ])
 * // Returns: [
 * //   { name: 'Small / Red', option1Name: 'Size', option1Value: 'Small', option2Name: 'Color', option2Value: 'Red' },
 * //   { name: 'Small / Blue', option1Name: 'Size', option1Value: 'Small', option2Name: 'Color', option2Value: 'Blue' },
 * //   { name: 'Large / Red', option1Name: 'Size', option1Value: 'Large', option2Name: 'Color', option2Value: 'Red' },
 * //   { name: 'Large / Blue', option1Name: 'Size', option1Value: 'Large', option2Name: 'Color', option2Value: 'Blue' }
 * // ]
 */
export function generateVariantCombinations(options: VariantOption[]): GeneratedVariant[] {
	if (options.length === 0) {
		throw new Error("At least one option is required to generate variants");
	}

	if (options.length > 3) {
		throw new Error("Maximum 3 options are supported (Shopify-compatible limit)");
	}

	for (const option of options) {
		if (!option.values || option.values.length === 0) {
			throw new Error(`Option '${option.name}' must have at least one value`);
		}
		if (!option.name || option.name.trim() === "") {
			throw new Error("Option name cannot be empty");
		}
	}

	const combinations: GeneratedVariant[] = [];

	if (options.length === 1) {
		const option1 = options[0];
		for (const value1 of option1.values) {
			combinations.push({
				name: value1,
				option1Name: option1.name,
				option1Value: value1,
			});
		}
		return combinations;
	}

	if (options.length === 2) {
		const option1 = options[0];
		const option2 = options[1];
		for (const value1 of option1.values) {
			for (const value2 of option2.values) {
				combinations.push({
					name: `${value1} / ${value2}`,
					option1Name: option1.name,
					option1Value: value1,
					option2Name: option2.name,
					option2Value: value2,
				});
			}
		}
		return combinations;
	}

	if (options.length === 3) {
		const option1 = options[0];
		const option2 = options[1];
		const option3 = options[2];
		for (const value1 of option1.values) {
			for (const value2 of option2.values) {
				for (const value3 of option3.values) {
					combinations.push({
						name: `${value1} / ${value2} / ${value3}`,
						option1Name: option1.name,
						option1Value: value1,
						option2Name: option2.name,
						option2Value: value2,
						option3Name: option3.name,
						option3Value: value3,
					});
				}
			}
		}
		return combinations;
	}

	return combinations;
}

/**
 * Calculate the total number of variant combinations from options.
 * Useful for displaying "Generate X variants" in UI.
 *
 * @param options - Array of options with values
 * @returns Total number of combinations
 *
 * @example
 * calculateVariantCount([
 *   { name: 'Size', values: ['Small', 'Medium', 'Large'] },
 *   { name: 'Color', values: ['Red', 'Blue'] }
 * ])
 * // Returns: 6
 */
export function calculateVariantCount(options: VariantOption[]): number {
	if (options.length === 0) {
		return 0;
	}

	let count = 1;
	for (const option of options) {
		if (option.values && option.values.length > 0) {
			count *= option.values.length;
		}
	}

	return count;
}
