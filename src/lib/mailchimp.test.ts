import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { createHash } from 'crypto';

// The module captures MAILCHIMP_API_KEY/DC at import time, so the env must be
// set before the import below evaluates (vi.hoisted runs before imports).
vi.hoisted(() => {
  process.env.MAILCHIMP_API_KEY = 'testkey-us1';
  process.env.MAILCHIMP_AUDIENCE_ID = 'audience-123';
});

import {
  addClubTag,
  removeClubTag,
  sendMailchimpEmail,
  clubTagFor,
  mailchimpRuntime,
} from './mailchimp';

const US1 = 'https://us1.api.mailchimp.com/3.0';
const HASH = createHash('md5').update('member@example.com').digest('hex');

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

function memberUpsertResponse() {
  return fakeResponse({ id: 'member-id', email_address: 'member@example.com', status: 'subscribed' });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterAll(() => {
  delete process.env.MAILCHIMP_API_KEY;
  delete process.env.MAILCHIMP_AUDIENCE_ID;
});

describe('clubTagFor', () => {
  it('namespaces a club slug under club:', () => {
    expect(clubTagFor('trieste')).toBe('club:trieste');
  });
});

describe('addClubTag', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('upserts the member into the audience then activates the club tag', async () => {
    fetchMock()
      .mockResolvedValueOnce(memberUpsertResponse())
      .mockResolvedValueOnce(fakeResponse({}, 200));

    // Member email in the URL hash is lowercased/trimmed; the body keeps the
    // stored casing.
    await addClubTag('Member@Example.COM ', 'trieste');

    expect(fetchMock()).toHaveBeenCalledTimes(2);

    const [upsertUrl, upsertInit] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(upsertUrl).toBe(`${US1}/lists/audience-123/members/${HASH}`);
    expect(upsertInit.method).toBe('PUT');
    expect(JSON.parse(String(upsertInit.body))).toEqual({
      email_address: 'Member@Example.COM ',
      status_if_new: 'subscribed',
    });
    expect(String(new Headers(upsertInit.headers).get('Authorization'))).toMatch(/^Basic /);

    const [tagUrl, tagInit] = fetchMock().mock.calls[1] as [string, RequestInit];
    expect(tagUrl).toBe(`${US1}/lists/audience-123/members/${HASH}/tags`);
    expect(tagInit.method).toBe('POST');
    expect(JSON.parse(String(tagInit.body))).toEqual({
      tags: [{ name: 'club:trieste', status: 'active' }],
    });
  });

  it('throws when the member upsert is rejected by the API', async () => {
    fetchMock().mockResolvedValueOnce(
      fakeResponse({ title: 'Invalid Resource', detail: 'The resource submitted could not be validated.' }, 400)
    );

    await expect(addClubTag('member@example.com', 'trieste')).rejects.toThrow(
      /Mailchimp member upsert failed: The resource submitted could not be validated\./
    );
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });
});

describe('removeClubTag', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('drops the club tag but leaves the contact on the audience', async () => {
    fetchMock().mockResolvedValueOnce(fakeResponse({}, 200));

    await removeClubTag('member@example.com', 'trieste');

    expect(fetchMock()).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${US1}/lists/audience-123/members/${HASH}/tags`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      tags: [{ name: 'club:trieste', status: 'inactive' }],
    });
  });

  it('treats a missing contact (404) as already untagged', async () => {
    fetchMock().mockResolvedValueOnce(fakeResponse({ title: 'Resource Not Found' }, 404));

    await expect(removeClubTag('member@example.com', 'trieste')).resolves.toBeUndefined();
    expect(fetchMock()).toHaveBeenCalledTimes(1);
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

  it('routes the event draft to the event club segment', async () => {
    fetchMock()
      .mockResolvedValueOnce(fakeResponse({
        segments: [
          { id: 7, name: 'club:trieste' },
          { id: 8, name: 'club:rome' },
        ],
      }))
      .mockResolvedValueOnce(fakeResponse({ id: 'campaign-1' }))
      .mockResolvedValueOnce(fakeResponse({}, 200))
      .mockResolvedValueOnce(fakeResponse({}, 200));

    await sendMailchimpEmail({
      name: 'Coffee Morning',
      date: '2026-09-01T10:00:00Z',
      slug: 'coffee-morning',
      club_slug: 'trieste',
      meeting_url: null,
      venue_name: null,
      venue_url: null,
    });

    expect(fetchMock()).toHaveBeenCalledTimes(4);

    const [segmentsUrl] = fetchMock().mock.calls[0] as [string, RequestInit];
    expect(segmentsUrl).toBe(`${US1}/lists/audience-123/segments`);

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

  it('skips the send when the event club has no segment yet', async () => {
    fetchMock().mockResolvedValueOnce(fakeResponse({ segments: [{ id: 7, name: 'club:trieste' }] }));

    await expect(
      sendMailchimpEmail({
        name: 'Venice Meetup',
        date: '2026-10-01T10:00:00Z',
        slug: 'venice-meetup',
        club_slug: 'venice',
        meeting_url: null,
        venue_name: null,
        venue_url: null,
      })
    ).resolves.toBeUndefined();

    // Only the segments lookup happened — no campaign was created.
    expect(fetchMock()).toHaveBeenCalledTimes(1);
  });

  it('does not hit the network from a local dev runtime', async () => {
    vi.spyOn(mailchimpRuntime, 'isLocalDev').mockReturnValue(true);

    await sendMailchimpEmail({
      name: 'Coffee Morning',
      date: '2026-09-01T10:00:00Z',
      slug: 'coffee-morning',
      club_slug: 'trieste',
      meeting_url: null,
      venue_name: null,
      venue_url: null,
    });

    expect(fetchMock()).not.toHaveBeenCalled();
  });
});