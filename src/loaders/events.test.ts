import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventsLoader } from './events';

const { mockSupabaseAdmin, mockGetAllClubs, mockUnwrapRelation, mockIsRsvpStatus } = vi.hoisted(() => {
  return {
    mockSupabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return {
            select: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        }
        if (table === 'rsvps') {
          return {
            select: () => Promise.resolve({ data: [], error: null }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    },
    mockGetAllClubs: vi.fn(() => Promise.resolve([])),
    mockUnwrapRelation: vi.fn((val) => val),
    mockIsRsvpStatus: vi.fn((status: string) => ['going', 'maybe', 'not_going'].includes(status)),
  };
});

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

vi.mock('../lib/clubs', () => ({
  getAllClubs: mockGetAllClubs,
}));

vi.mock('../lib/supabaseRelations', () => ({
  unwrapRelation: mockUnwrapRelation,
}));

vi.mock('../lib/rsvpTypes', () => ({
  isRsvpStatus: mockIsRsvpStatus,
}));

describe('eventsLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes meetPoint in the stored event data', async () => {
    mockGetAllClubs.mockResolvedValueOnce([{ id: 1, name: 'Trieste', slug: 'trieste' }] as never);
    const mockEvent = {
      id: 1,
      name: 'Test Event',
      date: '2025-06-01T19:00:00.000Z',
      end_date: '2025-06-01T20:30:00.000Z',
      is_online: false,
      club_id: 1,
      slug: 'test-event',
      description: 'Test description',
      summary: 'Test summary',
      instagram: null,
      facebook: null,
      meetup: null,
      meeting_url: null,
      meet_point: null,
      tags: [],
      created_by: 'user-1',
      venues: { name: 'Test Venue', url: 'https://maps.google.com' },
      members: {
        id: 'user-1',
        username: 'testuser',
        full_name: 'Test User',
        display_full_name: true,
        avatar_url: null,
      },
    };

    mockSupabaseAdmin.from.mockImplementation((table: string): any => {
      if (table === 'events') {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: [mockEvent], error: null }),
          }),
        };
      }
      if (table === 'rsvps') {
        return {
          select: () => Promise.resolve({ data: [], error: null }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const loader = eventsLoader();
    const store = {
      clear: vi.fn(),
      set: vi.fn(),
    };

    await loader.load({ store } as any);

    expect(store.set).toHaveBeenCalled();
    const callArgs = store.set.mock.calls[0]?.[0];
    expect(callArgs?.data).toHaveProperty('meetPoint');
  });

  // #177: online events belong to their club (the Online chapter) like any
  // other event.
  it('gives an online event its club as location', async () => {
    const onlineClub = { id: 2, name: 'Online', slug: 'online' };
    mockGetAllClubs.mockResolvedValueOnce([onlineClub] as never);
    const mockEvent = {
      id: 2,
      name: 'Online Event',
      date: '2025-06-01T19:00:00.000Z',
      end_date: '2025-06-01T20:30:00.000Z',
      is_online: true,
      club_id: 2,
      slug: 'online-event',
      description: null,
      summary: null,
      instagram: null,
      facebook: null,
      meetup: null,
      meeting_url: 'https://meet.jit.si/test',
      meet_point: null,
      tags: [],
      created_by: 'user-1',
      venues: null,
      members: { id: 'user-1', username: 'testuser', full_name: null, display_full_name: false, avatar_url: null },
    };
    mockSupabaseAdmin.from.mockImplementation((table: string): any => {
      if (table === 'events') {
        return { select: () => ({ order: () => Promise.resolve({ data: [mockEvent], error: null }) }) };
      }
      if (table === 'rsvps') {
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const store = { clear: vi.fn(), set: vi.fn() };
    await eventsLoader().load({ store } as any);

    expect(store.set.mock.calls[0]?.[0]?.data.location).toEqual(onlineClub);
  });

  // events.club_id is NOT NULL with a foreign key, so a club the loader can't
  // find means the clubs fetch failed or is stale: skip the event rather than
  // build a page with no chapter.
  it('skips an event whose club is missing', async () => {
    mockGetAllClubs.mockResolvedValueOnce([{ id: 1, name: 'Trieste', slug: 'trieste' }] as never);
    const mockEvent = {
      id: 3,
      name: 'Orphan Event',
      date: '2025-06-01T19:00:00.000Z',
      end_date: '2025-06-01T20:30:00.000Z',
      is_online: false,
      club_id: 99,
      slug: 'orphan-event',
      description: null,
      summary: null,
      instagram: null,
      facebook: null,
      meetup: null,
      meeting_url: null,
      meet_point: null,
      tags: [],
      created_by: 'user-1',
      venues: null,
      members: { id: 'user-1', username: 'testuser', full_name: null, display_full_name: false, avatar_url: null },
    };
    mockSupabaseAdmin.from.mockImplementation((table: string): any => {
      if (table === 'events') {
        return { select: () => ({ order: () => Promise.resolve({ data: [mockEvent], error: null }) }) };
      }
      if (table === 'rsvps') {
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const store = { clear: vi.fn(), set: vi.fn() };
    await eventsLoader().load({ store } as any);

    expect(store.set).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Skipping event "orphan-event": no matching club for club_id 99');
    consoleError.mockRestore();
  });
});
