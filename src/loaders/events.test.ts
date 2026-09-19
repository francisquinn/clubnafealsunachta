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

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
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
});