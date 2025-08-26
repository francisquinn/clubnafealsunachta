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
  })} ${date.getDate()} at ${date.getHours()}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}
