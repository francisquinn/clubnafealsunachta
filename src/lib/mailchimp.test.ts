import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

// The module captures MAILCHIMP_API_KEY/DC at import time, so the env must be
// set before the import below evaluates (vi.hoisted runs before imports).
vi.hoisted(() => {
  process.env.MAILCHIMP_API_KEY = 'testkey-us1';
  process.env.MAILCHIMP_AUDIENCE_ID = 'audience-123';
});

import {
  sendMailchimpEmail,
  chapterTagFor,
  mailchimpRuntime,
} from './mailchimp';

const US1 = 'https://us1.api.mailchimp.com/3.0';

// Stub the network: every Mailchimp call goes through global fetch, so
// replacing it means no test can reach the live API (see #55 acceptance).
function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

function fakeResponse(body: unknown, status = 200) {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    statusText: `status ${status}`,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterAll(() => {
  delete process.env.MAILCHIMP_API_KEY;
  delete process.env.MAILCHIMP_AUDIENCE_ID;
});

describe('chapterTagFor', () => {
  it('namespaces a chapter slug under chapter:', () => {
    expect(chapterTagFor('trieste')).toBe('chapter:trieste');
  });
});

describe('sendMailchimpEmail', () => {
  // The campaign path is dev-gated, but vitest runs with import.meta.env.DEV
  // === true — flip the seam so these tests exercise the real call sequence
  // against the stubbed fetch. One test below keeps the guard on to prove
  // the dev skip.
  beforeEach(() => {
    vi.spyOn(mailchimpRuntime, 'isLocalDev').mockReturnValue(false);
    globalThis.fetch = vi.fn();
  });

  it('routes the event draft to the event chapter segment', async () => {
    fetchMock()
      .mockResolvedValueOnce(fakeResponse({
        segments: [
          { id: 7, name: 'chapter:trieste' },
          { id: 8, name: 'chapter:rome' },
        ],
      }))
      .mockResolvedValueOnce(fakeResponse({ id: 'campaign-1' }))
      .mockResolvedValueOnce(fakeResponse({}, 200))
      .mockResolvedValueOnce(fakeResponse({}, 200));

    await sendMailchimpEmail({
      name: 'Coffee Morning',
      date: '2026-09-01T10:00:00Z',
      slug: 'coffee-morning',
      chapter_slug: 'trieste',
      meeting_url: null,
      venue_name: null,
      venue_url: null,
    });

    expect(fetchMock()).toHaveBeenCalledTimes(4);

    const [segmentsUrl] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(segmentsUrl).toBe(`${US1}/lists/audience-123/segments?count=1000&offset=0`);

    const [, campaignInit] = fetchMock().mock.calls[1] as [string, RequestInit];
    expect(campaignInit.method).toBe('POST');
    const campaignBody = JSON.parse(String(campaignInit.body));
    expect(campaignBody.recipients).toEqual({
      list_id: 'audience-123',
      segment_opts: { saved_segment_id: 7 },
    });
    expect(campaignBody.settings).toMatchObject({
      subject_line: 'Upcoming event - Coffee Morning',
      from_name: 'Club na Féalscúnachta',
    });

    const [contentUrl, contentInit] = fetchMock().mock.calls[2] as [string, RequestInit];
    expect(contentUrl).toBe(`${US1}/campaigns/campaign-1/content`);
    expect(contentInit.method).toBe('PUT');
    expect(String(contentInit.body)).toContain('Coffee Morning');

    const [sendUrl, sendInit] = fetchMock().mock.calls[3] as [string, RequestInit];
    expect(sendUrl).toBe(`${US1}/campaigns/campaign-1/actions/send`);
    expect(sendInit.method).toBe('POST');
  });

  it('skips the send when the event chapter has no segment yet', async () => {
    fetchMock().mockResolvedValueOnce(fakeResponse({ segments: [{ id: 7, name: 'chapter:trieste' }] }));

    await expect(
      sendMailchimpEmail({
        name: 'Venice Meetup',
        date: '2026-10-01T10:00:00Z',
        slug: 'venice-meetup',
        chapter_slug: 'venice',
        meeting_url: null,
        venue_name: null,
        venue_url: null,
      })
    ).resolves.toBeUndefined();

    // Only the segments lookup happened — no campaign was created.
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('pages through the segments list when the chapter segment is past the first page', async () => {
    // A full first page (no match) forces a second request at the next offset.
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `chapter:filler-${i}` }));

    fetchMock()
      .mockResolvedValueOnce(fakeResponse({ segments: firstPage }))
      .mockResolvedValueOnce(fakeResponse({ segments: [{ id: 42, name: 'chapter:trieste' }] }))
      .mockResolvedValueOnce(fakeResponse({ id: 'campaign-1' }))
      .mockResolvedValueOnce(fakeResponse({}, 200))
      .mockResolvedValueOnce(fakeResponse({}, 200));

    await sendMailchimpEmail({
      name: 'Coffee Morning',
      date: '2026-09-01T10:00:00Z',
      slug: 'coffee-morning',
      chapter_slug: 'trieste',
      meeting_url: null,
      venue_name: null,
      venue_url: null,
    });

    expect(fetchMock()).toHaveBeenCalledTimes(5);
    const [firstUrl] = fetchMock().mock.calls[0] as [string, RequestInit];
    const [secondUrl] = fetchMock().mock.calls[1] as [string, RequestInit];
    expect(firstUrl).toBe(`${US1}/lists/audience-123/segments?count=1000&offset=0`);
    expect(secondUrl).toBe(`${US1}/lists/audience-123/segments?count=1000&offset=1000`);

    const [, campaignInit] = fetchMock().mock.calls[2] as [string, RequestInit];
    expect(JSON.parse(String(campaignInit.body)).recipients).toEqual({
      list_id: 'audience-123',
      segment_opts: { saved_segment_id: 42 },
    });
  });

  it('does not hit the network from a local dev runtime', async () => {
    vi.spyOn(mailchimpRuntime, 'isLocalDev').mockReturnValue(true);

    await sendMailchimpEmail({
      name: 'Coffee Morning',
      date: '2026-09-01T10:00:00Z',
      slug: 'coffee-morning',
      chapter_slug: 'trieste',
      meeting_url: null,
      venue_name: null,
      venue_url: null,
    });

    expect(fetchMock()).not.toHaveBeenCalled();
  });
});