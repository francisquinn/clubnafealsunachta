import { describe, it, expect, vi, beforeEach } from 'vitest';

// Handler-level tests for createEvent/updateEvent. Astro actions don't expose
// their `handler` in tests, so `defineAction` is mocked to return the
// definition object as-is (giving us the raw handler to invoke) and
// `ActionError` is stubbed with the same shape the real class throws
// (`code` + `message`). The Supabase admin client is mocked table by table,
// same chained shape as real supabase-js, with `state` letting each test
// control exactly what comes back. requireAdmin is stubbed to return a
// per-test admin scope so the per-club scoping rules (#37) are exercised
// without JWT plumbing, while the pure helpers it shares (isClubInScope,
// scopeToAdminClubs) are kept real via importOriginal. Mailchimp and the
// Netlify build hook are mocked so the tests never touch the network.
const state = vi.hoisted(() => {
  return {
    // requireAdmin result - the caller's admin scope (null => not an admin).
    admin: null as {
      memberId: string;
      isSuperAdmin: boolean;
      clubIds: number[];
    } | null,
    // venues: lookup existing venue by id (.eq('id').single())
    venueLookupData: null as unknown as {
      id: number;
      name: string;
      url: string | null;
      club_id: number;
    } | null,
    venueLookupError: null as Error | null,
    // venues: upsert a "New venue…" submission (.single())
    venueUpsertData: null as unknown as {
      id: number;
      name: string;
      url: string | null;
      club_id: number;
    } | null,
    venueUpsertError: null as Error | null,
    // events: insert (createEvent)
    eventInsertError: null as Error | null,
    // events: the row createEvent tried to insert (captured for assertions).
    insertedEvent: null as Record<string, unknown> | null,
    // events: existing row lookup for updateEvent (.eq('slug').single())
    existingEventData: null as unknown as { club_id: number | null } | null,
    existingEventError: null as Error | null,
    // events: update (updateEvent)
    eventUpdateError: null as Error | null,
    eventUpdateSlug: null as string | null,
    // clubs: single-slug lookup used by createEvent's draft email fallback.
    clubSlugData: null as unknown as { slug: string } | null,
    clubSlugError: null as Error | null,
  };
});

vi.mock('astro:actions', () => {
  class MockActionError extends Error {
    code: string;
    constructor(params: { message?: string; code: string }) {
      super(params.message);
      this.name = 'ActionError';
      this.code = params.code;
    }
  }
  return {
    defineAction: (definition: { accept?: string; handler: unknown }) => definition,
    ActionError: MockActionError,
  };
});

// Keep the pure scope helpers (isClubInScope, scopeToAdminClubs) real while
// stubbing requireAdmin with the per-test scope. auth.ts reads JWT_SECRET and
// hits supabase for a live scope, neither of which a handler-level test wants.
vi.mock('../lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth')>();
  return {
    ...actual,
    requireAdmin: () => state.admin,
  };
});

vi.mock('../lib/supabase', () => {
  const admin = {
    from: (table: string) => {
      if (table === 'venues') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: state.venueLookupData,
                  error: state.venueLookupError,
                }),
            }),
          }),
          upsert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: state.venueUpsertData,
                  error: state.venueUpsertError,
                }),
            }),
          }),
        };
      }
      if (table === 'events') {
        return {
          insert: (rows: Record<string, unknown>[]) => {
            state.insertedEvent = rows[0] ?? null;
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({ data: null, error: state.eventInsertError }),
              }),
            };
          },
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: state.existingEventData,
                  error: state.existingEventError,
                }),
            }),
          }),
          update: () => ({
            eq: (column: string, value: string) => {
              if (column === 'slug') state.eventUpdateSlug = value;
              return Promise.resolve({ error: state.eventUpdateError });
            },
          }),
        };
      }
      if (table === 'clubs') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: state.clubSlugData,
                  error: state.clubSlugError,
                }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
  return { supabaseAdmin: admin, supabase: admin };
});

vi.mock('../lib/mailchimp', () => ({
  sendMailchimpEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/netlifyBuildHook', () => ({
  triggerNetlifyBuild: vi.fn(),
}));

import { createEvent, updateEvent } from './events';
import { sendMailchimpEmail } from '../lib/mailchimp';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';

// The mocked defineAction returns the definition object (not Astro's real
// client wrapper), so the raw handler is what reaches `handler`.
const createAction = createEvent as unknown as {
  handler: (formData: FormData, context: { request: Request }) => Promise<{ success: boolean }>;
};
const updateAction = updateEvent as unknown as {
  handler: (formData: FormData, context: { request: Request }) => Promise<{ success: boolean }>;
};

const SUPER_ADMIN = { memberId: 'admin-1', isSuperAdmin: true, clubIds: [] };
const CLUB_SCOPED_ADMIN = { memberId: 'admin-2', isSuperAdmin: false, clubIds: [10] };

function makeContext() {
  return { request: new Request('https://example.com/actions', { method: 'POST' }) };
}

function baseEventFormData(): FormData {
  const formData = new FormData();
  formData.append('name', 'Coffee Morning');
  formData.append('date', '2026-09-01T10:00:00Z');
  formData.append('slug', 'coffee-morning');
  return formData;
}

beforeEach(() => {
  state.admin = null;
  state.venueLookupData = null;
  state.venueLookupError = null;
  state.venueUpsertData = null;
  state.venueUpsertError = null;
  state.eventInsertError = null;
  state.insertedEvent = null;
  state.existingEventData = null;
  state.existingEventError = null;
  state.eventUpdateError = null;
  state.eventUpdateSlug = null;
  state.clubSlugData = null;
  state.clubSlugError = null;
  vi.mocked(sendMailchimpEmail).mockClear();
  vi.mocked(triggerNetlifyBuild).mockClear();
});

describe('createEvent', () => {
  it('rejects with UNAUTHORIZED before touching any data when not an admin', async () => {
    await expect(createAction.handler(baseEventFormData(), makeContext())).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(state.insertedEvent).toBeNull();
    expect(triggerNetlifyBuild).not.toHaveBeenCalled();
  });

  it('rejects with BAD_REQUEST when required fields are missing', async () => {
    state.admin = SUPER_ADMIN;
    await expect(createAction.handler(new FormData(), makeContext())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects with BAD_REQUEST when the slug has invalid characters', async () => {
    state.admin = SUPER_ADMIN;
    const formData = baseEventFormData();
    formData.set('slug', 'Not A Slug!');
    await expect(createAction.handler(formData, makeContext())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(state.insertedEvent).toBeNull();
  });

  it('creates an ONLINE event with no venue and no club', async () => {
    state.admin = SUPER_ADMIN;
    state.clubSlugData = { slug: 'trieste' };
    const formData = baseEventFormData();
    formData.append('is_online', 'true');
    formData.append('meeting_url', 'https://meet.example.com/abc');

    await expect(createAction.handler(formData, makeContext())).resolves.toEqual({ success: true });

    // Online: no venue, no hosting club — the online/venue exclusivity is
    // satisfied (this is the "online event with no venue" case).
    expect(state.insertedEvent).toMatchObject({
      name: 'Coffee Morning',
      is_online: true,
      venue_id: null,
      club_id: null,
      meeting_url: 'https://meet.example.com/abc',
      created_by: 'admin-1',
    });
    expect(triggerNetlifyBuild).toHaveBeenCalledTimes(1);
    expect(sendMailchimpEmail).toHaveBeenCalledTimes(1);
    expect(sendMailchimpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Coffee Morning', club_slug: 'trieste' })
    );
  });

  it('never resolves a venue for an online event, even if a venue_id is submitted', async () => {
    // The exclusivity invariant (an event can't be both online and tied to a
    // venue) is enforced by the handler by never looking the venue up when
    // is_online is true — a stale/forged venue_id is simply dropped.
    state.admin = SUPER_ADMIN;
    state.clubSlugData = { slug: 'trieste' };
    state.venueLookupData = { id: 5, name: 'The Library', url: null, club_id: 10 };
    const formData = baseEventFormData();
    formData.append('is_online', 'true');
    formData.append('venue_id', '5');

    await expect(createAction.handler(formData, makeContext())).resolves.toEqual({ success: true });

    expect(state.insertedEvent).toMatchObject({
      is_online: true,
      venue_id: null,
    });
  });

  it('creates an IN-PERSON event tied to an existing venue by id', async () => {
    state.admin = SUPER_ADMIN;
    state.clubSlugData = { slug: 'trieste' };
    state.venueLookupData = { id: 5, name: 'The Library', url: null, club_id: 10 };
    const formData = baseEventFormData();
    formData.append('venue_id', '5');

    await expect(createAction.handler(formData, makeContext())).resolves.toEqual({ success: true });

    // In-person: the hosting club is the venue's own club, not a separate field.
    expect(state.insertedEvent).toMatchObject({
      is_online: false,
      venue_id: 5,
      club_id: 10,
      meeting_url: null,
    });
    expect(sendMailchimpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ venue_name: 'The Library', venue_url: null })
    );
  });

  it('creates an IN-PERSON event and upserts a brand-new venue', async () => {
    state.admin = SUPER_ADMIN;
    state.clubSlugData = { slug: 'trieste' };
    state.venueUpsertData = { id: 9, name: 'New Hall', url: 'https://newhall.example.com', club_id: 10 };
    const formData = baseEventFormData();
    formData.append('club_id', '10');
    formData.append('location_name', 'New Hall');
    formData.append('location_url', 'https://newhall.example.com');

    await expect(createAction.handler(formData, makeContext())).resolves.toEqual({ success: true });

    expect(state.insertedEvent).toMatchObject({
      is_online: false,
      venue_id: 9,
      club_id: 10,
    });
  });

  it('rejects with FORBIDDEN when a club-scoped admin creates an in-person event with no club in scope', async () => {
    // In-person with no venue -> the event would be global (club_id null),
    // which a club-scoped admin has no standing to create.
    state.admin = CLUB_SCOPED_ADMIN;
    await expect(createAction.handler(baseEventFormData(), makeContext())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(state.insertedEvent).toBeNull();
  });

  it('rejects with FORBIDDEN when a club-scoped admin submits a venue from another club', async () => {
    state.admin = CLUB_SCOPED_ADMIN;
    state.venueLookupData = { id: 5, name: 'Somewhere Else', url: null, club_id: 99 };
    const formData = baseEventFormData();
    formData.append('venue_id', '5');

    await expect(createAction.handler(formData, makeContext())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(state.insertedEvent).toBeNull();
  });

  it('rejects online events from a club-scoped admin outside their clubs', async () => {
    state.admin = CLUB_SCOPED_ADMIN;
    const formData = baseEventFormData();
    formData.append('is_online', 'true');
    formData.append('event_club_id', '99');

    await expect(createAction.handler(formData, makeContext())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows an online event scoped to a club the club-scoped admin administers', async () => {
    state.admin = CLUB_SCOPED_ADMIN;
    state.clubSlugData = { slug: 'trieste' };
    const formData = baseEventFormData();
    formData.append('is_online', 'true');
    formData.append('event_club_id', '10');

    await expect(createAction.handler(formData, makeContext())).resolves.toEqual({ success: true });

    expect(state.insertedEvent).toMatchObject({ is_online: true, venue_id: null, club_id: 10 });
  });

  it('rejects with INTERNAL_SERVER_ERROR when the venue lookup fails', async () => {
    state.admin = SUPER_ADMIN;
    state.venueLookupError = new Error('boom');
    const formData = baseEventFormData();
    formData.append('venue_id', '5');
    await expect(createAction.handler(formData, makeContext())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('rejects with INTERNAL_SERVER_ERROR when the event insert fails', async () => {
    state.admin = SUPER_ADMIN;
    state.eventInsertError = new Error('boom');
    await expect(createAction.handler(baseEventFormData(), makeContext())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('rejects with INTERNAL_SERVER_ERROR when the club slug lookup fails', async () => {
    state.admin = SUPER_ADMIN;
    state.clubSlugError = new Error('boom');
    const formData = baseEventFormData();
    formData.append('club_id', '10');
    formData.append('location_name', 'New Hall');
    state.venueUpsertData = { id: 9, name: 'New Hall', url: null, club_id: 10 };
    await expect(createAction.handler(formData, makeContext())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});

describe('updateEvent', () => {
  it('rejects with UNAUTHORIZED before touching any data when not an admin', async () => {
    await expect(updateAction.handler(baseEventFormData(), makeContext())).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(state.eventUpdateSlug).toBeNull();
  });

  it('rejects with BAD_REQUEST when required fields are missing', async () => {
    state.admin = SUPER_ADMIN;
    await expect(updateAction.handler(new FormData(), makeContext())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it("rejects a club-scoped admin from editing an event in a club they don't administer", async () => {
    state.admin = CLUB_SCOPED_ADMIN;
    state.existingEventData = { club_id: 99 };
    await expect(updateAction.handler(baseEventFormData(), makeContext())).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(state.eventUpdateSlug).toBeNull();
  });

  it('allows a club-scoped admin to edit an in-person event via a venue in their club', async () => {
    state.admin = CLUB_SCOPED_ADMIN;
    state.existingEventData = { club_id: 10 };
    state.venueLookupData = { id: 5, name: 'The Library', url: null, club_id: 10 };
    const formData = baseEventFormData();
    formData.append('venue_id', '5');
    await expect(updateAction.handler(formData, makeContext())).resolves.toEqual({
      success: true,
    });
    expect(state.eventUpdateSlug).toBe('coffee-morning');
  });

  it('updates an event to be ONLINE with no venue', async () => {
    state.admin = SUPER_ADMIN;
    state.existingEventData = { club_id: null };
    const formData = baseEventFormData();
    formData.append('is_online', 'true');
    formData.append('meeting_url', 'https://meet.example.com/abc');

    await expect(updateAction.handler(formData, makeContext())).resolves.toEqual({ success: true });

    expect(state.eventUpdateSlug).toBe('coffee-morning');
    expect(triggerNetlifyBuild).toHaveBeenCalledTimes(1);
  });

  it('updates an event to be IN-PERSON with a venue', async () => {
    state.admin = SUPER_ADMIN;
    state.existingEventData = { club_id: 10 };
    state.venueLookupData = { id: 5, name: 'The Library', url: null, club_id: 10 };
    const formData = baseEventFormData();
    formData.append('venue_id', '5');

    await expect(updateAction.handler(formData, makeContext())).resolves.toEqual({ success: true });

    expect(state.eventUpdateSlug).toBe('coffee-morning');
    expect(triggerNetlifyBuild).toHaveBeenCalledTimes(1);
  });

  it('rejects with INTERNAL_SERVER_ERROR when looking up the existing event fails', async () => {
    state.admin = SUPER_ADMIN;
    state.existingEventError = new Error('boom');
    await expect(updateAction.handler(baseEventFormData(), makeContext())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('rejects with INTERNAL_SERVER_ERROR when the event update fails', async () => {
    state.admin = SUPER_ADMIN;
    state.existingEventData = { club_id: null };
    state.eventUpdateError = new Error('boom');
    await expect(updateAction.handler(baseEventFormData(), makeContext())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});
