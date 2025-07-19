import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/entries" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string()
  })
});

export const collections = { blog };