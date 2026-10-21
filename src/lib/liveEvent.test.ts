import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  configured: true,
  row: null as Record<string, unknown> | null,
  error: null as { message: string } | null,
  slug: null as string | null,
}));

vi.mock('./supabase', () => ({
  get supabaseAdmin() {
    return state.configured
      ? {
          from: () => ({
            select: () => ({
              eq: (_col: string, slug: string) => {
                state.slug = slug;
                return { maybeSingle: () => Promise.resolve({ data: state.row, error: state.error }) };
              },
            }),
          }),
        }
      : null;
  },
}));

import { fetchLiveEvent, liveEventToIcsData } from './liveEvent';

const row = {
  name: 'Talk',
  date: '2030-06-01T11:00:00+00:00',
  end_date: '2030-06-01T13:30:00+02:00',
  is_online: false,
  meeting_url: null,
  meet_point: 'Door',
  description: 'd',
  summary: null,
  venues: { name: 'Cafe', url: 'https://maps.example/c' },
};

beforeEach(() => {
  state.configured = true;
  state.row = { ...row };
  state.error = null;
  state.slug = null;
});

describe('fetchLiveEvent', () => {
  it('normalises offsets to UTC Z ISO strings and maps fields', async () => {
    const live = await fetchLiveEvent('talk');
    expect(state.slug).toBe('talk');
    expect(live).toEqual({
      name: 'Talk',
      date: '2030-06-01T11:00:00.000Z',
      endDate: '2030-06-01T11:30:00.000Z',
      isOnline: false,
      meetingUrl: null,
      meetPoint: 'Door',
      description: 'd',
      summary: null,
      venue: { name: 'Cafe', url: 'https://maps.example/c' },
    });
  });

  it('unwraps an array-shaped venue relation and tolerates none', async () => {
    state.row = { ...row, venues: [{ name: 'A', url: null }] };
    expect((await fetchLiveEvent('talk'))?.venue).toEqual({ name: 'A', url: null });
    state.row = { ...row, venues: null };
    expect((await fetchLiveEvent('talk'))?.venue).toBeNull();
  });

  it('returns null when the event does not exist', async () => {
    state.row = null;
    expect(await fetchLiveEvent('gone')).toBeNull();
  });

  it('throws on a query error', async () => {
    state.error = { message: 'boom' };
    await expect(fetchLiveEvent('talk')).rejects.toThrow('boom');
  });

  it('throws when Supabase is not configured', async () => {
    state.configured = false;
    await expect(fetchLiveEvent('talk')).rejects.toThrow(/not configured/);
  });
});

describe('liveEventToIcsData', () => {
  it('parses dates and adds the slug', async () => {
    const live = (await fetchLiveEvent('talk'))!;
    const ics = liveEventToIcsData('talk', live);
    expect(ics.slug).toBe('talk');
    expect(ics.endDate).toEqual(new Date('2030-06-01T11:30:00.000Z'));
  });
});
