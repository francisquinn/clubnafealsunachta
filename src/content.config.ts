import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { eventsLoader } from "./loaders/events";
import 'dotenv/config';

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/entries/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
  }),
});

const event = defineCollection({
  loader: eventsLoader(),
  schema: z.object({
    name: z.string(),
    date: z.date(),
    city: z.string().nullable(),
    location: z.object({
      name: z.string().nullable(),
      url: z.string().nullable(),
    }),
    slug: z.string(),
    description: z.string().nullable(),
    summary: z.string().nullable(),
    social: z.object({
      instagram: z.string().nullable(),
      facebook: z.string().nullable(),
      meetup: z.string().nullable(),
    }),
  }),
});

export const collections = { blog, event };
