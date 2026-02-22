import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/entries/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
  }),
});

const event = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/entries/events" }),
  schema: z.object({
    name: z.string(),
    date: z.coerce.date(),
    location: z.object({
      name: z.string(),
      url: z.string().url(),
    }),
    slug: z.string(),
    social: z.object({
      instagram: z.string().url(),
      facebook: z.string().url().optional(),
      meetup: z.string().url().optional(),
    }),
    debate: z.boolean().optional()
  }),
});

export const collections = { blog, event };
