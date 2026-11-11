import { describe, it, expect, vi, beforeEach } from 'vitest';

// #219: the confirm page's logic. The members update is stubbed and records
// its values and filters; the notice to the old address is mocked.
const state = vi.hoisted(() => ({
  updated: [{ id: 'm1' }] as { id: string }[],
  error: null as { code: string; message: string } | null,
  updates: [] as { values: unknown; eq: unknown[][]; lt: unknown[][] }[],
}));

vi.mock('./supabase', async () => {
  const { stubFrom, stubQuery } = await import('../test/supabaseStub');
  return {
    supabaseAdmin: {
      from: stubFrom({
        members: () =>
          stubQuery((calls) => {
            state.updates.push({
              values: calls.find((c) => c.method === 'update')?.args[0],
              eq: calls.filter((c) => c.method === 'eq').map((c) => c.args),
              lt: calls.filter((c) => c.method === 'lt').map((c) => c.args),
            });
            return state.error ? { data: null, error: state.error } : { data: state.updated, error: null };
          }),
      }),
    },
  };
});

vi.mock('./emailChangeEmail', () => ({
  sendEmailChangedNotice: vi.fn().mockResolvedValue(undefined),
}));

import { confirmEmailChange } from './confirmEmailChange';
import { sendEmailChangedNotice } from './emailChangeEmail';
import { createEmailChangeToken } from './auth';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  vi.clearAllMocks();
  state.updated = [{ id: 'm1' }];
  state.error = null;
  state.updates = [];
});

const token = () => createEmailChangeToken('m1', 'old@example.com', 'new@example.com');

describe('confirmEmailChange', () => {
  it('switches the email only while the old one is still current, then tells the old address', async () => {
    expect(await confirmEmailChange(token())).toBe('success');
    expect(state.updates).toEqual([
      {
        values: { email: 'new@example.com', email_verified_at: expect.any(String) },
        eq: [['id', 'm1'], ['email', 'old@example.com']],
        lt: [['email_change_sent_at', expect.any(String)]],
      },
    ]);
    expect(sendEmailChangedNotice).toHaveBeenCalledWith('old@example.com', 'new@example.com');
  });

  it('only accepts a link at least as new as the latest request', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T12:00:00.400Z'));
    let token: string;
    try {
      token = createEmailChangeToken('m1', 'old@example.com', 'new@example.com');
    } finally {
      vi.useRealTimers();
    }
    await confirmEmailChange(token);
    // Issued at 12:00:00 (whole seconds), so a request stamped any time up
    // to the end of that second still matches; a later one doesn't.
    expect(state.updates[0]!.lt).toEqual([['email_change_sent_at', '2026-11-11T12:00:01.000Z']]);
  });

  it('treats a used or outdated link as invalid', async () => {
    state.updated = [];
    expect(await confirmEmailChange(token())).toBe('invalid');
    expect(sendEmailChangedNotice).not.toHaveBeenCalled();
  });

  it('reports an address taken since the link was sent', async () => {
    state.error = { code: '23505', message: 'duplicate key' };
    expect(await confirmEmailChange(token())).toBe('taken');
    expect(sendEmailChangedNotice).not.toHaveBeenCalled();
  });

  it('reports other database errors', async () => {
    state.error = { code: 'XX000', message: 'boom' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await confirmEmailChange(token())).toBe('error');
  });

  it('rejects a missing or bad token without touching the database', async () => {
    expect(await confirmEmailChange(null)).toBe('invalid');
    expect(await confirmEmailChange('garbage')).toBe('invalid');
    expect(state.updates).toEqual([]);
  });

  it('still succeeds when the notice fails to send', async () => {
    vi.mocked(sendEmailChangedNotice).mockRejectedValueOnce(new Error('smtp down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await confirmEmailChange(token())).toBe('success');
  });
});
