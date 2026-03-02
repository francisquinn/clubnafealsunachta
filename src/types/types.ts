import type { CollectionEntry } from "astro:content";

export type EventCollection = CollectionEntry<"event">;

export type Event = {
  name: string;
  date: Date;
  location: {
    name: string;
    url: string;
  };
  slug: string;
  social: {
    instagram: string;
    facebook?: string;
    meetup?: string;
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
