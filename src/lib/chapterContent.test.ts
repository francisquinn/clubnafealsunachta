import { describe, it, expect } from 'vitest';
import { getChapterContent } from './chapterContent';

describe('getChapterContent', () => {
  it('returns each known chapter its own photo', () => {
    expect(getChapterContent('trieste').photo).toBe('/values/curiosity.jpg');
    expect(getChapterContent('online').photo).toBe('/values/open-mindedness.jpg');
  });

  it('gives Trieste its regular meeting, and chapters without one none', () => {
    expect(getChapterContent('trieste').meeting).toEqual({ when: 'Thursdays @ 18:30', where: 'Polo Toti', whereUrl: 'https://maps.app.goo.gl/DmRP9s2jtz7Ju8sq5' });
    expect(getChapterContent('online').meeting).toBeUndefined();
    expect(getChapterContent('somewhere-new').meeting).toBeUndefined();
  });

  it('gives Trieste a what-to-expect list, and chapters without one none', () => {
    expect(getChapterContent('trieste').whatToExpect?.length).toBeGreaterThan(0);
    expect(getChapterContent('online').whatToExpect).toBeUndefined();
  });

  it('gives Trieste its social links, and chapters without any none', () => {
    expect(getChapterContent('trieste').social?.map((l) => l.name)).toEqual(['Instagram', 'Facebook', 'Meetup']);
    expect(getChapterContent('online').social).toBeUndefined();
  });

  it('falls back to generic copy for a chapter without its own', () => {
    const content = getChapterContent('somewhere-new');
    expect(content.description).not.toBe('');
    expect(content.photo).toBe('/values/curiosity.jpg');
  });
});
