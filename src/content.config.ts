import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const postSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	pubDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	heroImage: z.string().optional(),
	tags: z.array(z.string()).optional(),
});

const blog = defineCollection({
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: postSchema,
});

const blogIt = defineCollection({
	loader: glob({ base: "./src/content/blog-it", pattern: "**/*.{md,mdx}" }),
	schema: postSchema,
});

export const collections = { blog, "blog-it": blogIt };
