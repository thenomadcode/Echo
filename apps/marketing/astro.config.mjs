import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	site: "https://echo.com",
	output: "server",
	adapter: cloudflare(),
	integrations: [react(), mdx(), sitemap()],
	vite: {
		plugins: [tailwindcss()],
	},
	server: {
		port: 3003,
	},
});
