const CHAPTER_CHOICE_KEY = "cnf-chosen-chapter";
const SLUG_PATTERN = /^[a-z0-9-]+$/;

// #194: the visitor's chosen chapter. Set by the events-page picker (and by
// landing on a chapter's events page), read by the home page's "See all
// events" link. localStorage can throw in some private-browsing modes, so
// both sides treat failure as "nothing chosen".
export function getChosenChapter(): string | null {
  try {
    const slug = localStorage.getItem(CHAPTER_CHOICE_KEY);
    return slug && SLUG_PATTERN.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

export function setChosenChapter(slug: string): void {
  try {
    localStorage.setItem(CHAPTER_CHOICE_KEY, slug);
  } catch {
    // Storage unavailable/full — the link just keeps its default.
  }
}
