import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Handler-level tests for resendVerification (#220). The email sender is
// mocked; the members table is a stub that records lookups and the cooldown
// claim (the conditional update).
const state = vi.hoisted(() => ({
  member: null as { id: string; email: string; email_verified_at: string | null; created_at: string } | null,
  claimed: true,
  claimError: null as { message: string } | null,
  lookups: [] as string[],
  claims: [] as { values: unknown; eq: unknown[][]; or: unknown }[],
  // Order of the cooldown claim and the email send.
  events: [] as string[],
}));

vi.mock('astro:actions', async () => (await import('../test/astroActions')).mockActionModule());

vi.mock('../lib/supabase', async () => {
  const { stubFrom, stubQuery } = await import('../test/supabaseStub');
  return {
    supabaseAdmin: {
      from: stubFrom({
        members: () =>
          stubQuery((calls) => {
            const update = calls.find((c) => c.method === 'update');
            if (update) {
              state.events.push('claim');
              state.claims.push({
                values: update.args[0],
                eq: calls.filter((c) => c.method === 'eq').map((c) => c.args),
                or: calls.find((c) => c.method === 'or')?.args[0],
              });
              if (state.claimError) return { data: null, error: state.claimError };
              return { data: state.claimed ? [{ id: state.member!.id }] : [], error: null };
            }
            const lookup = calls.find((c) => c.method === 'eq' || c.method === 'ilike')!;
            state.lookups.push(`${lookup.method}:${lookup.args[0]}=${lookup.args[1]}`);
            return { data: state.member ? [state.member] : [], error: null };
          }),
      }),
    },
  };
});

vi.mock('../lib/verificationEmail', () => ({
  sendVerificationEmail: vi.fn(() => {
    state.events.push('send');
    return Promise.resolve();
  }),
}));

import { resendVerification } from './resendVerification';
import { sendVerificationEmail } from '../lib/verificationEmail';

type Handler = (formData: FormData, context: { url: URL; site?: URL }) => Promise<{ success: boolean }>;
const handler = (resendVerification as unknown as { handler: Handler }).handler;

const context = { url: new URL('https://example.com/verify-email') };

async function run(identifier: string) {
  const fd = new FormData();
  fd.set('identifier', identifier);
  const start = Date.now();
  const promise = handler(fd, context);
  await vi.runAllTimersAsync();
  const result = await promise;
  return { result, elapsed: Date.now() - start };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.member = { id: 'm1', email: 'new@example.com', email_verified_at: null, created_at: new Date().toISOString() };
  state.claimed = true;
  state.claimError = null;
  state.lookups = [];
  state.claims = [];
  state.events = [];
});
afterEach(() => vi.useRealTimers());

describe('resendVerification', () => {
  it('sends a new link to an unverified member found by email', async () => {
    const { result } = await run(' New@Example.com ');
    expect(result).toEqual({ success: true });
    expect(state.lookups).toEqual(['eq:email=new@example.com']);
    expect(sendVerificationEmail).toHaveBeenCalledWith('new@example.com', 'https://example.com');
  });

  it('finds the member by username, ignoring case', async () => {
    await run('New_Member');
    expect(state.lookups).toEqual(['ilike:username=New\\_Member']);
    expect(sendVerificationEmail).toHaveBeenCalledWith('new@example.com', 'https://example.com');
  });

  it('claims only this member\'s cooldown slot, 5 minutes back, before sending', async () => {
    vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'));
    await run('new@example.com');
    expect(state.events).toEqual(['claim', 'send']);
    expect(state.claims).toHaveLength(1);
    expect(state.claims[0]!.values).toEqual({ verification_sent_at: '2026-11-10T12:00:00.000Z' });
    expect(state.claims[0]!.eq).toEqual([['id', 'm1']]);
    expect(state.claims[0]!.or).toBe('verification_sent_at.is.null,verification_sent_at.lt.2026-11-10T11:55:00.000Z');
  });

  it('sends nothing while the cooldown is running', async () => {
    state.claimed = false;
    const { result } = await run('new@example.com');
    expect(result).toEqual({ success: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends nothing to a verified member', async () => {
    state.member!.email_verified_at = '2026-01-01';
    await run('new@example.com');
    expect(state.claims).toHaveLength(0);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends nothing for an unconfirmed account past its 30 days', async () => {
    // Resending kept the cleanup clock running for ever before (Hume, epic review).
    state.member!.created_at = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const { result } = await run('new@example.com');
    expect(result).toEqual({ success: true });
    expect(state.claims).toHaveLength(0);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('takes the same minimum time and answers the same for an unknown account', async () => {
    const known = await run('new@example.com');
    state.member = null;
    const unknown = await run('nobody@example.com');
    expect(known.elapsed).toBeGreaterThanOrEqual(1500);
    expect(unknown.elapsed).toBe(known.elapsed);
    expect(unknown.result).toEqual({ success: true });
  });

  it('still answers success when the email fails to send', async () => {
    vi.mocked(sendVerificationEmail).mockRejectedValueOnce(new Error('smtp down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await run('new@example.com');
    expect(result).toEqual({ success: true });
  });

  it('logs and sends nothing when the cooldown claim fails', async () => {
    state.claimError = { message: 'column "verification_sent_at" does not exist' };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await run('new@example.com');
    expect(result).toEqual({ success: true });
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Failed to claim verification resend slot:', 'column "verification_sent_at" does not exist');
  });

  it('rejects an empty identifier', async () => {
    await expect(handler(new FormData(), context)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
