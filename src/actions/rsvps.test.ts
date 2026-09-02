import { describe, it, expect, vi, beforeEach } from 'vitest';

// Handler-level tests for getEventRsvps/setEventRsvp, mirroring the harness
// used in events.test.ts: defineAction is mocked to return the definition
// as-is (so the raw handler is directly invokable), ActionError is stubbed
// with the real class's shape (code + message), and the Supabase admin
// client is mocked per table with state controlling each query's response.
// verifySessionToken is stubbed against a fixed token so auth paths are
// exercised without JWT plumbing; getDisplayName (pure) is left real.
const state = vi.hoisted(() => {
  return {
    supabaseConfigured: true,
    // getEventRsvps/setEventRsvp both read the session cookie from context.
    sessionCookie: null as string | null,
    // events: slug lookup (.eq('slug').single()).
    eventId: null as unknown as { id: number } | null,
    eventLookupError: null as Error | null,
    // rsvps: select rows for an event (.eq('event_id')).
    rsvpRows: [] as {
      member_id: string;
      status: string;
      members: { username: string; full_name: string | null; display_full_name: boolean } | null;
    }[],
    rsvpFetchError: null as Error | null,
    // rsvps: the row setEventRsvp tried to upsert (captured for assertions).
    upsertedRow: null as Record<string, unknown> | null,
    upsertError: null as Error | null,
    // rsvps: the (member_id, event_id) filter setEventRsvp deleted by (captured for assertions).
    deletedFilter: null as Record<string, unknown> | null,
    deleteError: null as Error | null,
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

vi.mock('../lib/supabase', () => {
  const admin = {
    from: (table: string) => {
      if (table === 'events') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                state.eventLookupError
                  ? Promise.resolve({ data: null, error: state.eventLookupError })
                  : Promise.resolve({ data: state.eventId, error: null }),
            }),
          }),
        };
      }
      if (table === 'rsvps') {
        return {
          select: () => ({
            eq: () =>
              state.rsvpFetchError
                ? Promise.resolve({ data: null, error: state.rsvpFetchError })
                : Promise.resolve({ data: state.rsvpRows, error: null }),
          }),
          upsert: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
            state.upsertedRow = Array.isArray(rows) ? (rows[0] ?? null) : rows;
            return { error: state.upsertError };
          },
          delete: () => ({
            eq: (col1: string, val1: unknown) => ({
              eq: (col2: string, val2: unknown) => {
                state.deletedFilter = { [col1]: val1, [col2]: val2 };
                return Promise.resolve({ error: state.deleteError });
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
  return {
    supabase: null,
    supabaseAdmin: state.supabaseConfigured ? admin : null,
  };
});

vi.mock('../lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth')>();
  return {
    ...actual,
    verifySessionToken: (token: string | undefined) =>
      token === 'session-member-1' ? { memberId: 'member-1', isAdmin: false } : null,
  };
});

import { getEventRsvps, setEventRsvp } from './rsvps';
import type { RsvpState } from '../lib/rsvpTypes';

type Handler<I> = (input: I, context: { cookies: { get(name: string): { value?: string } | undefined } }) => Promise<RsvpState>;
const getHandler = (getEventRsvps as unknown as { handler: Handler<{ slug: string }> }).handler;
const setHandler = (setEventRsvp as unknown as { handler: Handler<{ slug: string; status: string | null }> }).handler;

function context(): { cookies: { get(name: string): { value?: string } | undefined } } {
  return {
    cookies: {
      get: (name: string) => (name === 'session' && state.sessionCookie ? { value: state.sessionCookie } : undefined),
    },
  };
}

const MEMBER_ALICE = { username: 'alice', full_name: null, display_full_name: false };
const MEMBER_BOB = { username: 'bob', full_name: 'Bob Smith', display_full_name: true };
const MEMBER_CAROL = { username: 'carol', full_name: null, display_full_name: false };

beforeEach(() => {
  state.supabaseConfigured = true;
  state.sessionCookie = null;
  state.eventId = { id: 10 };
  state.eventLookupError = null;
  state.rsvpRows = [];
  state.rsvpFetchError = null;
  state.upsertedRow = null;
  state.upsertError = null;
  state.deletedFilter = null;
  state.deleteError = null;
});

describe('getEventRsvps', () => {
  it('returns aggregate counts but no identifiable data for an anonymous visitor', async () => {
    state.rsvpRows = [
      { member_id: 'member-1', status: 'going', members: MEMBER_ALICE },
      { member_id: 'member-2', status: 'going', members: MEMBER_BOB },
      { member_id: 'member-3', status: 'maybe', members: MEMBER_CAROL },
      { member_id: 'member-4', status: 'not_going', members: MEMBER_ALICE },
    ];

    const result = await getHandler({ slug: 'philosophy-101' }, context());

    expect(result).toEqual({
      counts: { going: 2, maybe: 1, not_going: 1 },
      myStatus: null,
      lists: null,
    });
  });

  it('returns the named breakdowns and the member own status for a logged-in member', async () => {
    state.sessionCookie = 'session-member-1';
    state.rsvpRows = [
      { member_id: 'member-1', status: 'going', members: MEMBER_ALICE },
      { member_id: 'member-2', status: 'going', members: MEMBER_BOB },
      { member_id: 'member-3', status: 'maybe', members: MEMBER_CAROL },
    ];

    const result = await getHandler({ slug: 'philosophy-101' }, context());

    expect(result).toEqual({
      counts: { going: 2, maybe: 1, not_going: 0 },
      myStatus: 'going',
      lists: {
        going: [MEMBER_ALICE, MEMBER_BOB],
        maybe: [MEMBER_CAROL],
        not_going: [] as typeof MEMBER_ALICE[],
      },
    });
  });

  it('sorts named lists by display name', async () => {
    state.sessionCookie = 'session-member-1';
    state.rsvpRows = [
      { member_id: 'member-1', status: 'going', members: MEMBER_ALICE },
      { member_id: 'member-2', status: 'going', members: MEMBER_BOB },
    ];

    const result = await getHandler({ slug: 'philosophy-101' }, context());

    // "alice" sorts before "Bob Smith" case-sensitively, but getDisplayName
    // resolves display_full_name members to their full name — deterministic
    // ordering matters more than the exact collation here.
    expect(result.lists).not.toBeNull();
    expect(result.lists?.going.map((m) => m.username)).toEqual(['alice', 'bob']);
  });

  it('skips rows whose member relation is missing, still counting the rest', async () => {
    state.sessionCookie = 'session-member-1';
    state.rsvpRows = [
      { member_id: 'member-1', status: 'going', members: MEMBER_ALICE },
      { member_id: 'ghost', status: 'going', members: null },
    ];

    const result = await getHandler({ slug: 'philosophy-101' }, context());

    expect(result.counts).toEqual({ going: 1, maybe: 0, not_going: 0 });
  });

  it('throws BAD_REQUEST for an unknown event slug', async () => {
    state.eventId = null;
    state.eventLookupError = new Error('PGRST116: no rows');

    await expect(getHandler({ slug: 'nope' }, context())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Event not found',
    });
  });

  it('throws BAD_REQUEST for a missing slug', async () => {
    await expect(getHandler({ slug: '' }, context())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});

describe('setEventRsvp', () => {
  it('throws UNAUTHORIZED for a visitor without a session', async () => {
    await expect(setHandler({ slug: 'philosophy-101', status: 'going' }, context())).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('throws BAD_REQUEST for an invalid status', async () => {
    state.sessionCookie = 'session-member-1';
    await expect(setHandler({ slug: 'philosophy-101', status: 'definitely' }, context())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('upserts the member event row and returns the fresh state', async () => {
    state.sessionCookie = 'session-member-1';
    const submittedAt = new Date().toISOString();
    state.upsertError = null;
    // Simulate what the DB looks like right after the upsert: the member's
    // own going row plus one other member who is maybe.
    state.rsvpRows = [
      { member_id: 'member-1', status: 'going', members: MEMBER_ALICE },
      { member_id: 'member-3', status: 'maybe', members: MEMBER_CAROL },
    ];

    const result = await setHandler({ slug: 'philosophy-101', status: 'going' }, context());

    expect(state.upsertedRow).toMatchObject({
      member_id: 'member-1',
      event_id: 10,
      status: 'going',
    });
    expect(typeof state.upsertedRow?.updated_at).toBe('string');
    expect(new Date(String(state.upsertedRow?.updated_at)).getTime()).toBeGreaterThanOrEqual(
      new Date(submittedAt).getTime() - 1
    );

    expect(result).toEqual({
      counts: { going: 1, maybe: 1, not_going: 0 },
      myStatus: 'going',
      lists: {
        going: [MEMBER_ALICE],
        maybe: [MEMBER_CAROL],
        not_going: [],
      },
    });
  });

  it('deletes the member row and returns the fresh state, when status is null', async () => {
    state.sessionCookie = 'session-member-1';
    // Simulate what the DB looks like right after the delete: the member's
    // own row is gone, one other member's "maybe" remains.
    state.rsvpRows = [{ member_id: 'member-3', status: 'maybe', members: MEMBER_CAROL }];

    const result = await setHandler({ slug: 'philosophy-101', status: null }, context());

    expect(state.deletedFilter).toEqual({ member_id: 'member-1', event_id: 10 });
    expect(state.upsertedRow).toBeNull();

    expect(result).toEqual({
      counts: { going: 0, maybe: 1, not_going: 0 },
      myStatus: null,
      lists: {
        going: [],
        maybe: [MEMBER_CAROL],
        not_going: [],
      },
    });
  });

  it('throws INTERNAL_SERVER_ERROR for a failed delete', async () => {
    state.sessionCookie = 'session-member-1';
    state.deleteError = new Error('disk full');

    await expect(setHandler({ slug: 'philosophy-101', status: null }, context())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('throws BAD_REQUEST for an unknown event slug', async () => {
    state.sessionCookie = 'session-member-1';
    state.eventId = null;
    state.eventLookupError = new Error('PGRST116: no rows');

    await expect(setHandler({ slug: 'nope', status: 'going' }, context())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Event not found',
    });
  });

  it('throws INTERNAL_SERVER_ERROR for a failed upsert', async () => {
    state.sessionCookie = 'session-member-1';
    state.upsertError = new Error('disk full');

    await expect(setHandler({ slug: 'philosophy-101', status: 'maybe' }, context())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});