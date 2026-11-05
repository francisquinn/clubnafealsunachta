import { describe, it, expect } from 'vitest';
import { getChapterContent } from './chapterContent';
import type { Chapter } from './chapters';

const bare: Chapter = { id: 9, name: 'Somewhere New', slug: 'somewhere-new' };

describe('getChapterContent', () => {
  it('uses the chapter row\'s own copy and photo', () => {
    const content = getChapterContent({ ...bare, description: 'Hello.', photo: '/values/open-mindedness.jpg' });
    expect(content.description).toBe('Hello.');
    expect(content.photo).toBe('/values/open-mindedness.jpg');
  });

  it('builds the regular meeting from its columns', () => {
    const content = getChapterContent({ ...bare, meeting_when: 'Thursdays @ 18:30', meeting_venue: { name: 'Polo Toti', url: 'https://maps.example/x' } });
    expect(content.meeting).toEqual({ when: 'Thursdays @ 18:30', where: 'Polo Toti', whereUrl: 'https://maps.example/x' });
  });

  it('shows a venue without a link as plain text', () => {
    const content = getChapterContent({ ...bare, meeting_when: 'Fridays', meeting_venue: { name: 'The Pub', url: null } });
    expect(content.meeting).toEqual({ when: 'Fridays', where: 'The Pub', whereUrl: undefined });
  });

  it('shows no meeting for a chapter without one', () => {
    expect(getChapterContent(bare).meeting).toBeUndefined();
    expect(getChapterContent({ ...bare, meeting_when: null, meeting_venue: null }).meeting).toBeUndefined();
  });

  it('passes the chat link, what-to-expect list and social links through, and treats null or empty as none', () => {
    const social = [{ name: 'Instagram', href: 'https://example.com', icon: '/instagram.svg' }];
    const full = getChapterContent({ ...bare, chat_url: 'https://chat.example', what_to_expect: ['One.'], social });
    expect(full.chatUrl).toBe('https://chat.example');
    expect(full.whatToExpect).toEqual(['One.']);
    expect(full.social).toEqual(social);

    const none = getChapterContent({ ...bare, chat_url: null, what_to_expect: [], social: null });
    expect(none.chatUrl).toBeUndefined();
    expect(none.whatToExpect).toBeUndefined();
    expect(none.social).toBeUndefined();
  });

  it('falls back to generic copy for a chapter without its own', () => {
    const content = getChapterContent(bare);
    expect(content.description).not.toBe('');
    expect(content.photo).toBe('/values/curiosity.jpg');
  });
});
