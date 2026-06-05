import { defineCollection, z } from "astro:content";
import { eventsLoader } from "./loaders/events";
import { postsLoader } from "./loaders/posts";
import 'dotenv/config';

const blog = defineCollection({
  loader: postsLoader(),
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
    location: z.object({
      id: z.number(),
      name: z.string(),
    }).nullable(),
    venue: z.object({
      name: z.string().nullable(),
      url: z.string().nullable(),
    }).nullable(),
    slug: z.string(),
    description: z.string().nullable(),
    summary: z.string().nullable(),
    social: z.object({
      instagram: z.string().nullable(),
      facebook: z.string().nullable(),
      meetup: z.string().nullable(),
    }),
    meetingUrl: z.string().nullable(),
  }),
});

export const collections = { blog, event };
