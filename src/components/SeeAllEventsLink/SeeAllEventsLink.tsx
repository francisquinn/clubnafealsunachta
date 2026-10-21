import { useEffect, useState } from "react";
import { DEFAULT_CHAPTER_SLUG } from "../../lib/chapterDefaults";
import { getChosenChapter } from "../../utils/chapterChoice";

// #194: links to the visitor's chosen chapter's events page. With no choice
// yet (or the stored slug is no longer a current chapter) it falls back to the
// default chapter's page (/trieste/events), which carries the chapter picker —
// no standalone picker page exists. Starts on the default so server and first
// client render match.
export default function SeeAllEventsLink({ chapterSlugs }: { chapterSlugs: string[] }) {
  const [slug, setSlug] = useState(DEFAULT_CHAPTER_SLUG);
  useEffect(() => {
    const chosen = getChosenChapter();
    setSlug(chosen && chapterSlugs.includes(chosen) ? chosen : DEFAULT_CHAPTER_SLUG);
  }, [chapterSlugs]);
  return <a href={`/${slug}/events`}>See all events</a>;
}
