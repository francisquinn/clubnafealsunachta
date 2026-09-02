import { describe, it, expect, vi, beforeEach } from 'vitest';

// Handler-level tests for createEvent/updateEvent/getClubs/getVenues, mirroring
// the harness used in rsvps.test.ts: defineAction is mocked to return the
// definition as-is (so the raw handler is directly invokable), ActionError is
// stubbed with the real class's shape (code + message), and both Supabase
// clients are mocked per table with state controlling each query's response.
// requireAdmin is stubbed directly (rather than faking cookies/JWTs) since
// isClubInScope/scopeToAdminClubs — the two scoping helpers this file actually
// exercises — are pure and kept real via importOriginal. sendMailchimpEmail
// and triggerNetlifyBuild are stubbed as plain side-effect recorders.
const state = vi.hoisted(() => {
  return {
    supabaseConfigured: true,
    // requireAdmin's resolved scope for the current test.
    admin: null as { memberId: string; isSuperAdmin: boolean; clubIds: number[] } | null,

    // events: insert (createEvent) / select+eq+single (updateEvent's existing-club
    // check) / update+eq (updateEvent).
    insertedEvent: null as Record<string, unknown> | null,
    insertedEventRow: { id: 42 } as { id: number } | null,
    eventInsertError: null as Error | null,
    existingEvent: null as { club_id: number | null } | null,
    existingEventError: null as Error | null,
    updatedEvent: null as Record<string, unknown> | null,
    eventUpdateError: null as Error | null,

    // venues (admin client): existing-venue lookup + new-venue upsert, both used
    // by resolveVenue.
    venueById: null as { id: number; name: string; url: string | null; club_id: number } | null,
    venueLookupError: null as Error | null,
    upsertedVenuePayload: null as Record<string, unknown> | null,
    upsertedVenueRow: null as { id: number; name: string; url: string | null; club_id: number } | null,
    venueUpsertError: null as Error | null,

    // clubs (admin client): slug lookup for the Mailchimp draft in createEvent.
    clubBySlugLookup: null as { slug: string } | null,
    clubLookupError: null as Error | null,

    // rsvps (admin client): the host's seeded "going" row on createEvent.
    rsvpInsertPayload: null as Record<string, unknown> | null,
    rsvpInsertError: null as Error | null,

    // clubs/venues (non-admin client): the scoped lists getClubs/getVenues return.
    clubsList: [] as { id: number; name: string }[],
    clubsListError: null as Error | null,
    clubsScopeFilter: null as { col: string; vals: number[] } | null,
    venuesList: [] as { id: number; name: string; url: string | null; club_id: number }[],
    venuesListError: null as Error | null,
    venuesScopeFilter: null as { col: string; vals: number[] } | null,

    // side effects.
    mailchimpCall: null as unknown,
    mailchimpError: null as Error | null,
    netlifyBuildCalled: false,
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

vi.mock('../lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth')>();
  return {
    ...actual,
    requireAdmin: async () => state.admin,
  };
});

vi.mock('../lib/mailchimp', () => ({
  sendMailchimpEmail: (event: unknown) => {
    state.mailchimpCall = event;
    return state.mailchimpError ? Promise.reject(state.mailchimpError) : Promise.resolve();
  },
}));

vi.mock('../lib/netlifyBuildHook', () => ({
  triggerNetlifyBuild: () => {
    state.netlifyBuildCalled = true;
  },
}));

// A minimal thenable that scopeToAdminClubs can optionally call `.in(...)` on
// before it's awaited — matches how a real Supabase query builder behaves
// (each modifier returns something still awaitable).
function scopableQuery(
  result: { data: unknown; error: Error | null },
  onIn: (col: string, vals: number[]) => void
) {
  const query = {
    in: (col: string, vals: number[]) => {
      onIn(col, vals);
      return query;
    },
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  return query;
}

vi.mock('../lib/supabase', () => {
  const adminClient = {
    from: (table: string) => {
      if (table === 'events') {
        return {
          insert: (rows: Record<string, unknown>[]) => {
            state.insertedEvent = rows[0] ?? null;
            return {
              select: () => ({
                single: () =>
                  state.eventInsertError
                    ? Promise.resolve({ data: null, error: state.eventInsertError })
                    : Promise.resolve({ data: state.insertedEventRow, error: null }),
              }),
            };
          },
          select: () => ({
            eq: () => ({
              single: () =>
                state.existingEventError
                  ? Promise.resolve({ data: null, error: state.existingEventError })
                  : Promise.resolve({ data: state.existingEvent, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            state.updatedEvent = patch;
            return { eq: () => Promise.resolve({ error: state.eventUpdateError }) };
          },
        };
      }
      if (table === 'venues') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                state.venueLookupError
                  ? Promise.resolve({ data: null, error: state.venueLookupError })
                  : Promise.resolve({ data: state.venueById, error: null }),
            }),
          }),
          upsert: (row: Record<string, unknown>) => {
            state.upsertedVenuePayload = row;
            return {
              select: () => ({
                single: () =>
                  state.venueUpsertError
                    ? Promise.resolve({ data: null, error: state.venueUpsertError })
                    : Promise.resolve({ data: state.upsertedVenueRow, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'clubs') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                state.clubLookupError
                  ? Promise.resolve({ data: null, error: state.clubLookupError })
                  : Promise.resolve({ data: state.clubBySlugLookup, error: null }),
            }),
          }),
        };
      }
      if (table === 'rsvps') {
        return {
          // createEvent seeds the host's RSVP through the same upsertRsvp
          // helper setEventRsvp uses (see rsvps.test.ts) — an upsert, not a
          // plain insert.
          upsert: (row: Record<string, unknown>) => {
            state.rsvpInsertPayload = row;
            return Promise.resolve({ error: state.rsvpInsertError });
          },
        };
      }
      throw new Error(`Unexpected table (admin): ${table}`);
    },
  };

  const nonAdminClient = {
    from: (table: string) => {
      if (table === 'clubs') {
        return {
          select: () => ({
            order: () =>
              scopableQuery(
                state.clubsListError
                  ? { data: null, error: state.clubsListError }
                  : { data: state.clubsList, error: null },
                (col, vals) => {
                  state.clubsScopeFilter = { col, vals };
                }
              ),
          }),
        };
      }
      if (table === 'venues') {
        return {
          select: () => ({
            order: () =>
              scopableQuery(
                state.venuesListError
                  ? { data: null, error: state.venuesListError }
                  : { data: state.venuesList, error: null },
                (col, vals) => {
                  state.venuesScopeFilter = { col, vals };
                }
              ),
          }),
        };
      }
      throw new Error(`Unexpected table (non-admin): ${table}`);
    },
  };

  return {
    supabase: state.supabaseConfigured ? nonAdminClient : null,
    supabaseAdmin: state.supabaseConfigured ? adminClient : null,
  };
});

import { createEvent, updateEvent, getClubs, getVenues } from './events';
import { DEFAULT_CLUB_SLUG } from '../lib/clubDefaults';

type Ctx = { request: Request };
type FormHandler = (formData: FormData, context: Ctx) => Promise<{ success: true }>;
type QueryHandler = (input: undefined, context: Ctx) => Promise<unknown>;

const createHandler = (createEvent as unknown as { handler: FormHandler }).handler;
const updateHandler = (updateEvent as unknown as { handler: FormHandler }).handler;
const getClubsHandler = (getClubs as unknown as { handler: QueryHandler }).handler;
const getVenuesHandler = (getVenues as unknown as { handler: QueryHandler }).handler;

function context(): Ctx {
  return { request: new Request('https://example.com') };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const SUPER_ADMIN = { memberId: 'admin-1', isSuperAdmin: true, clubIds: [] as number[] };
const CLUB_ADMIN = { memberId: 'admin-2', isSuperAdmin: false, clubIds: [3] };

const ONLINE_FORM = {
  name: 'Philosophy Night',
  date: '2099-01-01T18:00:00.000Z',
  slug: 'philosophy-night',
  is_online: 'true',
  meeting_url: 'https://meet.jit.si/x',
};

beforeEach(() => {
  state.supabaseConfigured = true;
  state.admin = null;
  state.insertedEvent = null;
  state.insertedEventRow = { id: 42 };
  state.eventInsertError = null;
  state.existingEvent = null;
  state.existingEventError = null;
  state.updatedEvent = null;
  state.eventUpdateError = null;
  state.venueById = null;
  state.venueLookupError = null;
  state.upsertedVenuePayload = null;
  state.upsertedVenueRow = null;
  state.venueUpsertError = null;
  state.clubBySlugLookup = { slug: 'trieste' };
  state.clubLookupError = null;
  state.rsvpInsertPayload = null;
  state.rsvpInsertError = null;
  state.clubsList = [];
  state.clubsListError = null;
  state.clubsScopeFilter = null;
  state.venuesList = [];
  state.venuesListError = null;
  state.venuesScopeFilter = null;
  state.mailchimpCall = null;
  state.mailchimpError = null;
  state.netlifyBuildCalled = false;
});

describe('createEvent', () => {
  it('throws UNAUTHORIZED without a valid admin session', async () => {
    await expect(createHandler(form(ONLINE_FORM), context())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws BAD_REQUEST for missing required fields', async () => {
    state.admin = SUPER_ADMIN;

    await expect(createHandler(form({ name: 'X' }), context())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Missing required fields',
    });
  });

  it('throws BAD_REQUEST for an invalid slug format', async () => {
    state.admin = SUPER_ADMIN;

    await expect(
      createHandler(form({ ...ONLINE_FORM, slug: 'Not A Slug!' }), context())
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Slug must contain only lowercase letters, numbers and hyphens',
    });
  });

  it('throws FORBIDDEN when a club-scoped admin picks a venue outside their clubs', async () => {
    state.admin = CLUB_ADMIN; // clubIds: [3]
    state.venueById = { id: 9, name: 'Elsewhere Hall', url: null, club_id: 7 };

    await expect(
      createHandler(form({ ...ONLINE_FORM, is_online: 'false', venue_id: '9' }), context())
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('creates an online event, seeds a going RSVP for the host, and returns success', async () => {
    state.admin = SUPER_ADMIN;
    state.insertedEventRow = { id: 42 };

    const result = await createHandler(form(ONLINE_FORM), context());

    expect(result).toEqual({ success: true });
    expect(state.insertedEvent).toMatchObject({
      name: 'Philosophy Night',
      date: '2099-01-01T18:00:00.000Z',
      slug: 'philosophy-night',
      is_online: true,
      venue_id: null,
      club_id: null,
      created_by: 'admin-1',
      meeting_url: 'https://meet.jit.si/x',
    });
    // #27: the host is seeded as a real "going" row, not a bumped count —
    // via the shared upsertRsvp helper, so it carries the same updated_at
    // audit stamp as a member's own RSVP does.
    expect(state.rsvpInsertPayload).toMatchObject({ member_id: 'admin-1', event_id: 42, status: 'going' });
    expect(state.rsvpInsertPayload?.updated_at).toEqual(expect.any(String));
    expect(state.netlifyBuildCalled).toBe(true);
    expect(state.mailchimpCall).toMatchObject({ slug: 'philosophy-night', club_slug: DEFAULT_CLUB_SLUG });
  });

  it("creates an in-person event via an existing venue, using the venue's club", async () => {
    state.admin = CLUB_ADMIN; // clubIds: [3]
    state.venueById = { id: 5, name: 'The Reading Room', url: 'https://example.com/venue', club_id: 3 };
    state.insertedEventRow = { id: 43 };
    state.clubBySlugLookup = { slug: 'galway' };

    const result = await createHandler(
      form({
        name: 'In-Person Talk',
        date: '2099-02-01T18:00:00.000Z',
        slug: 'in-person-talk',
        is_online: 'false',
        venue_id: '5',
      }),
      context()
    );

    expect(result).toEqual({ success: true });
    expect(state.insertedEvent).toMatchObject({ venue_id: 5, club_id: 3, created_by: 'admin-2' });
    expect(state.rsvpInsertPayload).toMatchObject({ member_id: 'admin-2', event_id: 43, status: 'going' });
    expect(state.mailchimpCall).toMatchObject({ club_slug: 'galway', venue_name: 'The Reading Room' });
  });

  it('still creates the event when seeding the host RSVP fails', async () => {
    state.admin = SUPER_ADMIN;
    state.rsvpInsertError = new Error('constraint violation');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await createHandler(form(ONLINE_FORM), context());

    expect(result).toEqual({ success: true });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('still creates the event when the Mailchimp draft fails', async () => {
    state.admin = SUPER_ADMIN;
    state.mailchimpError = new Error('Mailchimp is down');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await createHandler(form(ONLINE_FORM), context());

    expect(result).toEqual({ success: true });
    consoleError.mockRestore();
  });

  it('throws INTERNAL_SERVER_ERROR when the event insert fails', async () => {
    state.admin = SUPER_ADMIN;
    state.eventInsertError = new Error('duplicate slug');

    await expect(createHandler(form(ONLINE_FORM), context())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});

describe('updateEvent', () => {
  const UPDATE_FORM = {
    name: 'Updated Name',
    date: '2099-03-01T18:00:00.000Z',
    slug: 'philosophy-night',
    is_online: 'true',
    meeting_url: 'https://meet.jit.si/y',
  };

  it('throws UNAUTHORIZED without a valid admin session', async () => {
    await expect(updateHandler(form(UPDATE_FORM), context())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws BAD_REQUEST for missing required fields', async () => {
    state.admin = SUPER_ADMIN;

    await expect(updateHandler(form({ slug: 'philosophy-night' }), context())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('throws INTERNAL_SERVER_ERROR when the existing event lookup fails', async () => {
    state.admin = SUPER_ADMIN;
    state.existingEventError = new Error('not found');

    await expect(updateHandler(form(UPDATE_FORM), context())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it("throws FORBIDDEN when the admin isn't in scope for the event's existing club", async () => {
    state.admin = CLUB_ADMIN; // clubIds: [3]
    state.existingEvent = { club_id: 9 };

    await expect(updateHandler(form(UPDATE_FORM), context())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('updates the event and triggers a rebuild', async () => {
    state.admin = SUPER_ADMIN;
    state.existingEvent = { club_id: null };

    const result = await updateHandler(form(UPDATE_FORM), context());

    expect(result).toEqual({ success: true });
    expect(state.updatedEvent).toMatchObject({ name: 'Updated Name', is_online: true });
    expect(state.netlifyBuildCalled).toBe(true);
    // Only createEvent seeds a host RSVP — updating an event never should.
    expect(state.rsvpInsertPayload).toBeNull();
  });

  it('throws INTERNAL_SERVER_ERROR when the update fails', async () => {
    state.admin = SUPER_ADMIN;
    state.existingEvent = { club_id: null };
    state.eventUpdateError = new Error('db down');

    await expect(updateHandler(form(UPDATE_FORM), context())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});

describe('getClubs', () => {
  it('throws UNAUTHORIZED without a valid admin session', async () => {
    await expect(getClubsHandler(undefined, context())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns every club, unscoped, for a super admin', async () => {
    state.admin = SUPER_ADMIN;
    state.clubsList = [
      { id: 1, name: 'Trieste' },
      { id: 2, name: 'Galway' },
    ];

    const result = await getClubsHandler(undefined, context());

    expect(result).toEqual(state.clubsList);
    expect(state.clubsScopeFilter).toBeNull();
  });

  it("scopes the query to a club-scoped admin's own clubs", async () => {
    state.admin = CLUB_ADMIN; // clubIds: [3]
    state.clubsList = [{ id: 3, name: 'Galway' }];

    const result = await getClubsHandler(undefined, context());

    expect(result).toEqual(state.clubsList);
    expect(state.clubsScopeFilter).toEqual({ col: 'id', vals: [3] });
  });
});

describe('getVenues', () => {
  it('throws UNAUTHORIZED without a valid admin session', async () => {
    await expect(getVenuesHandler(undefined, context())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it("scopes the query to a club-scoped admin's own clubs, by club_id", async () => {
    state.admin = CLUB_ADMIN; // clubIds: [3]
    state.venuesList = [{ id: 5, name: 'The Reading Room', url: null, club_id: 3 }];

    const result = await getVenuesHandler(undefined, context());

    expect(result).toEqual(state.venuesList);
    expect(state.venuesScopeFilter).toEqual({ col: 'club_id', vals: [3] });
  });
});
