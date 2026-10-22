import { ONLINE_CHAPTER_SLUG } from './chapterDefaults';

// Per-chapter copy and photo for the chapters index and each chapter's own
// page. The chapters table only holds id/name/slug, so this lives in code until
// there is a reason to make it editable. Photos are borrowed from the values
// page.
// `meeting` is the regular meet-up; left out for a chapter without one (Online
// has no fixed time yet).
type SocialLink = { name: string; href: string; icon: string };

type ChapterContent = {
  description: string;
  photo: string;
  meeting?: { when: string; where: string; whereUrl: string };
  // Invite link to the chapter's chat group; left out when there isn't one.
  chatUrl?: string;
  // Short points for a first-timer, in the order they'll meet them: before
  // coming, the evening, afterwards. Left out when a chapter has none yet.
  whatToExpect?: string[];
  // The chapter's social accounts; left out when it has none to point at.
  social?: SocialLink[];
};

const CHAPTER_CONTENT: Record<string, ChapterContent> = {
  trieste: {
    description:
      'Our home chapter, where it all began.',
    photo: '/values/curiosity.jpg',
    meeting: { when: 'Thursdays @ 18:30', where: 'Polo Toti', whereUrl: 'https://maps.app.goo.gl/DmRP9s2jtz7Ju8sq5' },
    chatUrl: 'https://chat.whatsapp.com/DWWJHDzgH8OJzSslTIwP0u',
    // TODO: draft copy, confirm before launch.
    whatToExpect: [
      'You don\'t need any philosophy background.',
      'It\'s free of charge.',
      'No booking needed, just turn up.',
      'Sessions are held in English.',
      'We meet outside Bar Barakin @ 18:00.',
      'Each session is built around one central question or topic.',
      'If there are many of us, we split into small groups, each with its own facilitator.',
      'Some sessions use a different format, so the evening can vary.',
      'Sessions last about an hour and a half.',
      'Afterwards we head out for a bite and a pint, and keep the conversation flowing.',
    ],
    // The club-wide accounts, same as the footer's, until a chapter has its own.
    social: [
      { name: 'Instagram', href: 'https://www.instagram.com/clubnafealsunachta/', icon: '/instagram.svg' },
      { name: 'Facebook', href: 'https://www.facebook.com/people/Club-na-Fealsúnachta/61578150433186/', icon: '/facebook.svg' },
      { name: 'Meetup', href: 'https://www.meetup.com/clubnafealsunachta/', icon: '/meetup.svg' },
    ],
  },
  [ONLINE_CHAPTER_SLUG]: {
    description:
      'Discussions you can join from anywhere. The Online chapter brings people together over video for the same open, curious conversations, wherever you are in the world.',
    photo: '/values/open-mindedness.jpg',
  },
};

// A chapter without its own copy yet still gets a sensible page.
const FALLBACK_CONTENT: ChapterContent = {
  description:
    'A chapter of Club na Fealsúnachta, meeting for philosophical discussions in a safe and friendly environment.',
  photo: '/values/curiosity.jpg',
};

export function getChapterContent(slug: string): ChapterContent {
  return CHAPTER_CONTENT[slug] ?? FALLBACK_CONTENT;
}
