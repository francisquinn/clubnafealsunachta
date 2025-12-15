import type { Event } from "../types/types";

export function formatBlogDate(date: Date): string {
  return `${date.toLocaleDateString("en-US", {
    month: "short",
  })} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatEventDate(date: Date): string {
  return `${date.toLocaleDateString("en-US", {
    weekday: "short",
  })} ${date.toLocaleDateString("en-US", {
    month: "short",
  })} ${date.getDate()} @ ${date.getHours()}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

export function isEventExpired(event: Event | null) {
  return event ? new Date(event.date) < new Date() : true;
}

export async function fetchEventGistJson(): Promise<Event[]> {
  try {
    const gistRes = await fetch(
      "https://api.github.com/gists/1cd791792915a94f892707c3296413e5",
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.PUBLIC_GIST_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    const data = await gistRes.json();
    const file = data.files["cnf-topics.json"];

    const rawRes = await fetch(file.raw_url);
    return await rawRes.json();
  } catch (e) {
    console.error("whoops, an error has occured fetching the gist data :(", e);
    return [];
  }
}

export async function getCurrentEvent(): Promise<Event | null> {
  const topics: Event[] = await fetchEventGistJson();
  return topics[0] ?? null;
}
