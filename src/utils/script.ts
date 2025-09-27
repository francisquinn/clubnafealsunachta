const TOPICS_GIST = import.meta.env.TOPICS_GIST;

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

export async function fetchEventGistJson() {
  try {
    const gistRes = await fetch(TOPICS_GIST);
    const data = await gistRes.json();
    const file = data.files["cnf-topics.json"];

    const rawRes = await fetch(file.raw_url);
    return await rawRes.json();
  } catch (e) {
    console.error("whoops, an error has occured fetching the gist data :(", e);
    return [];
  }

}

export async function getCurrentEvent() {
  const topics = await fetchEventGistJson();
  return topics[0] ?? null;
}
