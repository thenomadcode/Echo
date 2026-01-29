import { forwardRef, useEffect, useState } from "react";

import { CURRENCY_LOCALES, CURRENCY_SYMBOLS } from "@/lib/formatting";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Currency = "COP" | "BRL" | "MXN" | "USD";

interface PriceInputProps {
	currency: Currency;
	value: number;
	onChange: (valueInCents: number) => void;
	className?: string;
	id?: string;
	name?: string;
	placeholder?: string;
	disabled?: boolean;
}

function formatPriceForDisplay(valueInCents: number, currency: Currency): string {
	const valueInMajorUnits = valueInCents / 100;

	return new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(valueInMajorUnits);
}

function parseDisplayValue(displayValue: string): number {
	const cleanedValue = displayValue.replace(/[^\d.]/g, "");

	const parsed = Number.parseFloat(cleanedValue);

	if (Number.isNaN(parsed)) {
		return 0;
	}

	return Math.round(parsed * 100);
}

export const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(
	({ currency, value, onChange, className, id, name, placeholder, disabled }, ref) => {
		const [displayValue, setDisplayValue] = useState("");
		const [isFocused, setIsFocused] = useState(false);

		useEffect(() => {
			if (!isFocused) {
				setDisplayValue(formatPriceForDisplay(value, currency));
			}
		}, [value, currency, isFocused]);

		const handleFocus = () => {
			setIsFocused(true);
			const valueInMajorUnits = value / 100;
			setDisplayValue(valueInMajorUnits.toFixed(2));
		};

		const handleBlur = () => {
			setIsFocused(false);
			const valueInCents = parseDisplayValue(displayValue);
			onChange(valueInCents);
		};

		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;

			if (/^[\d.]*$/.test(newValue)) {
				setDisplayValue(newValue);

				if (!isFocused) {
					const valueInCents = parseDisplayValue(newValue);
					onChange(valueInCents);
				}
			}
		};

		const currencySymbol = CURRENCY_SYMBOLS[currency];

		return (
			<div className="relative">
				<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
					<span className="text-muted-foreground sm:text-sm">{currencySymbol}</span>
				</div>
				<Input
					ref={ref}
					id={id}
					name={name}
					type="text"
					inputMode="decimal"
					value={displayValue}
					onChange={handleChange}
					onFocus={handleFocus}
					onBlur={handleBlur}
					placeholder={placeholder || "0.00"}
					disabled={disabled}
					className={cn("pl-8", className)}
				/>
			</div>
		);
	},
);

PriceInput.displayName = "PriceInput";
