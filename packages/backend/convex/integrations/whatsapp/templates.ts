// WhatsApp message templates - pre-approved messages for sending outside 24h window
// Template variables use {{n}} placeholders (1-indexed) per WhatsApp Business API spec

export interface TemplateVariable {
	position: number;
	defaultValue?: string;
	description: string;
}

export interface MessageTemplate {
	name: string;
	language: string;
	category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
	body: string;
	variables: TemplateVariable[];
}

// Re-engagement template: {{1}} = business name, {{2}} = context/reason
export const RE_ENGAGEMENT_TEMPLATE: MessageTemplate = {
	name: "echo_reengagement_v1",
	language: "en",
	category: "UTILITY",
	body: "Hi! {{1}} here. {{2}} Reply to this message to continue our conversation.",
	variables: [
		{ position: 1, description: "Business name" },
		{ position: 2, defaultValue: "We wanted to follow up with you.", description: "Context" },
	],
};

// Order update template: {{1}} = customer name, {{2}} = order number, {{3}} = status
export const ORDER_UPDATE_TEMPLATE: MessageTemplate = {
	name: "echo_order_update_v1",
	language: "en",
	category: "UTILITY",
	body: "Hi {{1}}! Your order #{{2}} is now {{3}}. Reply for more details.",
	variables: [
		{ position: 1, defaultValue: "there", description: "Customer name" },
		{ position: 2, description: "Order number" },
		{ position: 3, description: "Order status" },
	],
};

export const TEMPLATES: Record<string, MessageTemplate> = {
	[RE_ENGAGEMENT_TEMPLATE.name]: RE_ENGAGEMENT_TEMPLATE,
	[ORDER_UPDATE_TEMPLATE.name]: ORDER_UPDATE_TEMPLATE,
};

export function renderTemplate(template: MessageTemplate, values: Record<number, string>): string {
	let result = template.body;
	for (const variable of template.variables) {
		const value = values[variable.position] ?? variable.defaultValue ?? `{{${variable.position}}}`;
		result = result.replace(`{{${variable.position}}}`, value);
	}
	return result;
}

export function getTemplate(name: string): MessageTemplate | undefined {
	return TEMPLATES[name];
}
