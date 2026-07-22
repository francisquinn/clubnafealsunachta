// ILIKE treats `%` and `_` as wildcards, and usernames are allowed to contain `_`,
// so it must be escaped to keep the match exact rather than a pattern.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
