import type { CollectionEntry } from "astro:content";

export type EventCollection = CollectionEntry<"event">;

export type Event = {
  name: string;
  date: Date;
  location: {
    id: number;
    name: string;
    slug: string;
  } | null;
  isOnline: boolean;
  venue: {
    name: string | null;
    url: string | null;
  } | null;
  slug: string;
  social: {
    instagram?: string | null;
    facebook?: string | null;
    meetup?: string | null;
  };
  meetingUrl: string | null;
  rsvpCounts: {
    going: number;
    maybe: number;
    not_going: number;
  };
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
