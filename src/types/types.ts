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
  // Issue #52: the hosting chapter (events.club_id), exposed separately
  // from `location` because online events keep `location` null to stay
  // "visible on every chapter" (see #60) yet still need their organizing
  // club surfaced on cards and in the per-club online filter.
  club: {
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
