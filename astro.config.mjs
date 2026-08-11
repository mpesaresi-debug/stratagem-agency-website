// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	site: "https://stratagem.agency",
	// /evolve started as a QR-code landing page but its content is evergreen
	// positioning for Chinese brands expanding abroad — the only page on the
	// site covering that market, and the only Simplified Chinese content we
	// have. It is indexed deliberately.
	integrations: [mdx(), sitemap()],
	adapter: cloudflare({
		platformProxy: {
			enabled: true,
		},
	}),
	vite: {
		plugins: [tailwindcss()],
	},
});
