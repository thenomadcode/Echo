import { useState } from "react";

interface FAQItem {
	question: string;
	answer: string;
}

const faqItems: FAQItem[] = [
	{
		question: "Can I change plans later?",
		answer:
			"Yes! You can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference. When downgrading, the new rate applies at your next billing cycle.",
	},
	{
		question: "What happens when I hit my free plan limits?",
		answer:
			"On the Free plan, you're limited to 500 contacts. When you reach this limit, you'll need to upgrade to continue adding new contacts. Your existing conversations will continue working normally.",
	},
	{
		question: "Are there any contracts or commitments?",
		answer:
			"No contracts! All plans are month-to-month. You can cancel anytime from your dashboard. We believe in earning your business every month.",
	},
	{
		question: "Do you offer annual billing discounts?",
		answer:
			"Yes! When you choose annual billing, you get 2 months free (about 17% off). You can switch to annual billing at any time from your account settings.",
	},
	{
		question: "What payment methods do you accept?",
		answer:
			"We accept all major credit cards (Visa, Mastercard, American Express) and PayPal. For Scale plan customers, we also offer invoice billing with NET 30 terms.",
	},
];

export function FAQ() {
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	const toggleItem = (index: number) => {
		setOpenIndex(openIndex === index ? null : index);
	};

	return (
		<div className="space-y-4">
			{faqItems.map((item, index) => (
				<div key={index} className="overflow-hidden rounded-lg border border-border">
					<button
						onClick={() => toggleItem(index)}
						className="flex w-full items-center justify-between bg-background p-4 text-left transition-colors hover:bg-muted/50"
					>
						<span className="font-heading font-medium text-foreground">{item.question}</span>
						<svg
							className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
								openIndex === index ? "rotate-180" : ""
							}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>
					<div
						className={`overflow-hidden transition-all duration-200 ${
							openIndex === index ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
						}`}
					>
						<div className="p-4 pt-0 text-muted-foreground">{item.answer}</div>
					</div>
				</div>
			))}
		</div>
	);
}

export default FAQ;
