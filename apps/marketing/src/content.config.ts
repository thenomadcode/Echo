import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

const pages = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/pages" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		draft: z.boolean().default(false),
		template: z.enum(["default", "landing", "minimal"]).default("default"),
	}),
});

const features = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/features" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		icon: z.string(),
		order: z.number(),
		category: z.string(),
	}),
});

const testimonials = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/testimonials" }),
	schema: z.object({
		name: z.string(),
		company: z.string(),
		role: z.string(),
		avatar: z.string().optional(),
		rating: z.number().min(1).max(5),
		featured: z.boolean().default(false),
	}),
});

const changelog = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/changelog" }),
	schema: z.object({
		version: z.string(),
		date: z.coerce.date(),
		title: z.string(),
		tags: z.array(z.string()).default([]),
	}),
});

const faq = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/faq" }),
	schema: z.object({
		question: z.string(),
		category: z.string(),
		order: z.number(),
	}),
});

const legal = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/legal" }),
	schema: z.object({
		title: z.string(),
		lastUpdated: z.coerce.date(),
		slug: z.string(),
	}),
});

const pricing = defineCollection({
	loader: glob({ pattern: "**/*.json", base: "./src/content/pricing" }),
	schema: z.object({
		name: z.string(),
		price: z.number(),
		currency: z.enum(["USD", "COP", "BRL", "MXN"]).default("USD"),
		interval: z.enum(["month", "year"]).default("month"),
		popular: z.boolean().default(false),
		features: z.array(z.string()),
		cta: z.string(),
		ctaLink: z.string(),
	}),
});

export const collections = {
	pages,
	features,
	testimonials,
	changelog,
	faq,
	legal,
	pricing,
};
