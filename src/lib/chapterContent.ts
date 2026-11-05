import type { Chapter } from './chapters';

// Per-chapter copy and photo for the chapters index and each chapter's own
// page, read from the chapter's row (#132). Photos are borrowed from the
// values page. `meeting` is the regular meet-up; absent for a chapter without
// one (Online has no fixed time yet).
type SocialLink = { name: string; href: string; icon: string };

export type ChapterContent = {
  description: string;
  photo: string;
  meeting?: { when: string; where: string; whereUrl?: string };
  // Invite link to the chapter's chat group; absent when there isn't one.
  chatUrl?: string;
  // Short points for a first-timer, in the order they'll meet them: before
  // coming, the evening, afterwards. Absent when a chapter has none yet.
  whatToExpect?: string[];
  // The chapter's social accounts; absent when it has none to point at.
  social?: SocialLink[];
};

// A chapter without its own copy yet still gets a sensible page.
const FALLBACK_DESCRIPTION =
  'A chapter of Club na Fealsúnachta, meeting for philosophical discussions in a safe and friendly environment.';
const FALLBACK_PHOTO = '/values/curiosity.jpg';

const orUndefined = <T,>(list: T[] | null | undefined) => (list && list.length > 0 ? list : undefined);

export function getChapterContent(chapter: Chapter): ChapterContent {
  const { meeting_when: when, meeting_venue: venue } = chapter;
  return {
    description: chapter.description || FALLBACK_DESCRIPTION,
    photo: chapter.photo || FALLBACK_PHOTO,
    meeting: when && venue ? { when, where: venue.name, whereUrl: venue.url ?? undefined } : undefined,
    chatUrl: chapter.chat_url || undefined,
    whatToExpect: orUndefined(chapter.what_to_expect),
    social: orUndefined(chapter.social),
  };
}
