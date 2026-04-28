import type { CollectionEntry } from "astro:content";

export const CITY = {
  TRIESTE: "Trieste",
} as const;
export type City = typeof CITY[keyof typeof CITY];

export type EventCollection = CollectionEntry<"event">;

export type Event = {
  name: string;
  date: Date;
  city?: string | null;
  location: {
    name: string | null;
    url: string | null;
  };
  slug: string;
  social: {
    instagram?: string | null;
    facebook?: string | null;
    meetup?: string | null;
  };
  debate?: boolean;
};

export interface BannerProps {
  title: string;
  description: string;
  location: {
    name: string;
    url: string;
    isExternal?: boolean;
  }
};
