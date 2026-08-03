// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	site: "https://stratagem.agency",
	// /evolve is a QR-code landing page for a single event — keep it out of the
	// sitemap so it never competes with the main site in search.
	integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/evolve') })],
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
	vite: {
		plugins: [tailwindcss()],
	},
});
