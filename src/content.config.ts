import { defineCollection, z } from "astro:content";
import { eventsLoader } from "./loaders/events";
import { postsLoader } from "./loaders/posts";
import 'dotenv/config';

const memberRefSchema = z.object({
  username: z.string(),
  full_name: z.string().nullable(),
  display_full_name: z.boolean(),
});

const blog = defineCollection({
  loader: postsLoader(),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: memberRefSchema,
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
      slug: z.string(),
    }).nullable(),
    isOnline: z.boolean(),
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
    creator: memberRefSchema,
    rsvpCounts: z.object({
      going: z.number(),
      maybe: z.number(),
      not_going: z.number(),
    }),
  }),
});

export const collections = { blog, event };
