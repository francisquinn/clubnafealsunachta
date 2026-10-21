import { describe, it, expect, vi, beforeEach } from 'vitest';

// Handler-level tests for getEventLive, same harness as rsvps.test.ts:
// defineAction returns the definition as-is, fetchLiveEvent is mocked.
const state = vi.hoisted(() => ({
  result: null as unknown,
  error: null as Error | null,
  calledWith: null as string | null,
}));

vi.mock('astro:actions', async () => (await import('../test/astroActions')).mockActionModule());
vi.mock('../lib/liveEvent', () => ({
  fetchLiveEvent: async (slug: string) => {
    state.calledWith = slug;
    if (state.error) throw state.error;
    return state.result;
  },
}));
// events.ts imports these at module load; none are used by getEventLive.
vi.mock('../lib/supabase', () => ({ supabase: {}, supabaseAdmin: {} }));
vi.mock('../lib/mailchimp', () => ({ sendMailchimpEmail: vi.fn() }));
vi.mock('../lib/netlifyBuildHook', () => ({ triggerNetlifyBuild: vi.fn() }));

import { getEventLive } from './events';

const handler = (getEventLive as unknown as { handler: (input: { slug: string }) => Promise<unknown> }).handler;

beforeEach(() => {
  state.result = null;
  state.error = null;
  state.calledWith = null;
});

describe('getEventLive', () => {
  it('validates the slug at the input boundary', () => {
    const input = (getEventLive as unknown as { input: { safeParse(v: unknown): { success: boolean } } }).input;
    expect(input.safeParse({ slug: '' }).success).toBe(false);
    expect(input.safeParse({ slug: 5 }).success).toBe(false);
    expect(input.safeParse({}).success).toBe(false);
    expect(input.safeParse({ slug: 'talk' }).success).toBe(true);
  });

  it('returns the live event', async () => {
    state.result = { name: 'Talk', meetingUrl: 'https://meet.jit.si/x' };
    await expect(handler({ slug: 'talk' })).resolves.toEqual(state.result);
    expect(state.calledWith).toBe('talk');
  });

  it('maps a missing event to NOT_FOUND', async () => {
    await expect(handler({ slug: 'gone' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('maps a query failure to INTERNAL_SERVER_ERROR', async () => {
    state.error = new Error('db down');
    await expect(handler({ slug: 'talk' })).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
});
