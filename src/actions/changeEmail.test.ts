import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Handler-level tests for requestEmailChange (#219). verifySession and the
// email sender are mocked; password hashing stays real.
const state = vi.hoisted(() => ({
  session: null as { memberId: string; isAdmin: boolean; username: string } | null,
  member: null as { email: string; password_hash: string } | null,
  takenBy: null as { id: string } | null,
  // Whether the cooldown claim matches a row, and every update the action made.
  claimed: true,
  updates: [] as { values: unknown; eq: unknown[][]; or: unknown }[],
}));

vi.mock('astro:actions', async () => (await import('../test/astroActions')).mockActionModule());

vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/auth')>()),
  verifySession: () => Promise.resolve(state.session),
}));

vi.mock('../lib/emailChangeEmail', () => ({
  sendEmailChangeConfirmation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/supabase', async () => {
  const { stubFrom, stubQuery } = await import('../test/supabaseStub');
  return {
    supabaseAdmin: {
      from: stubFrom({
        members: () =>
          stubQuery((calls) => {
            const update = calls.find((c) => c.method === 'update');
            if (update) {
              state.updates.push({
                values: update.args[0],
                eq: calls.filter((c) => c.method === 'eq').map((c) => c.args),
                or: calls.find((c) => c.method === 'or')?.args[0],
              });
              const isClaim = calls.some((c) => c.method === 'or');
              return { data: isClaim && state.claimed ? [{ id: 'm1' }] : [], error: null };
            }
            const eq = calls.find((c) => c.method === 'eq')!;
            // Looking up the signed-in member by id, or checking whether the new address is taken.
            if (eq.args[0] === 'id') return { data: state.member ? [state.member] : [], error: null };
            return { data: state.takenBy ? [state.takenBy] : [], error: null };
          }),
      }),
    },
  };
});

import { requestEmailChange } from './changeEmail';
import { sendEmailChangeConfirmation } from '../lib/emailChangeEmail';
import { hashPassword } from '../lib/auth';

type Handler = (formData: FormData, context: unknown) => Promise<{ success: boolean }>;
const handler = (requestEmailChange as unknown as { handler: Handler }).handler;

const PASSWORD = 'My-password1';
let hash: string;

beforeAll(async () => {
  hash = await hashPassword(PASSWORD);
});

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { memberId: 'm1', isAdmin: false, username: 'alice' };
  state.member = { email: 'old@example.com', password_hash: hash };
  state.takenBy = null;
  state.claimed = true;
  state.updates = [];
});

function run(newEmail: string, password = PASSWORD, request: { url: URL; site?: URL } = { url: new URL('https://example.com/profile/edit') }) {
  const fd = new FormData();
  fd.set('new_email', newEmail);
  fd.set('password', password);
  const context = { cookies: { get: () => ({ value: 'token' }) }, ...request };
  return handler(fd, context);
}

describe('requestEmailChange', () => {
  it('sends a confirmation link to the new address', async () => {
    await expect(run(' New@Example.com ')).resolves.toEqual({ success: true });
    expect(sendEmailChangeConfirmation).toHaveBeenCalledWith('m1', 'old@example.com', 'new@example.com', 'https://example.com');
  });

  // The link switches the account's email, so a spoofed Host header must not
  // be able to point it at someone else's domain.
  it('links to the configured site in production, ignoring the request host', async () => {
    vi.stubEnv('PROD', true);
    try {
      await run('new@example.com', PASSWORD, {
        url: new URL('https://evil.example/profile/edit'),
        site: new URL('https://clubnafealsunachta.com'),
      });
      expect(sendEmailChangeConfirmation).toHaveBeenCalledWith('m1', 'old@example.com', 'new@example.com', 'https://clubnafealsunachta.com');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rejects a signed-out request', async () => {
    state.session = null;
    await expect(run('new@example.com')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(sendEmailChangeConfirmation).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    await expect(run('new@example.com', 'Wrong-password1')).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'That password is incorrect' });
    expect(sendEmailChangeConfirmation).not.toHaveBeenCalled();
  });

  it('rejects an invalid email', async () => {
    await expect(run('not-an-email')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects the current address', async () => {
    await expect(run('OLD@example.com')).rejects.toMatchObject({ code: 'BAD_REQUEST', message: "That's already your email" });
    expect(sendEmailChangeConfirmation).not.toHaveBeenCalled();
  });

  it('rejects an address another account uses', async () => {
    state.takenBy = { id: 'm2' };
    await expect(run('new@example.com')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(sendEmailChangeConfirmation).not.toHaveBeenCalled();
  });

  it('says so when the email fails to send, and frees the slot for a retry', async () => {
    vi.mocked(sendEmailChangeConfirmation).mockRejectedValueOnce(new Error('smtp down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(run('new@example.com')).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(state.updates.at(-1)).toEqual({ values: { email_change_sent_at: null }, eq: [['id', 'm1']], or: undefined });
  });

  it("claims only this member's cooldown slot, 5 minutes back, before sending", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-11T12:00:00.000Z'));
    try {
      await run('new@example.com');
    } finally {
      vi.useRealTimers();
    }
    expect(state.updates).toEqual([
      {
        values: { email_change_sent_at: '2026-11-11T12:00:00.000Z' },
        eq: [['id', 'm1']],
        or: 'email_change_sent_at.is.null,email_change_sent_at.lt.2026-11-11T11:55:00.000Z',
      },
    ]);
    expect(sendEmailChangeConfirmation).toHaveBeenCalledTimes(1);
  });

  it('refuses another link inside the cooldown, without sending', async () => {
    state.claimed = false;
    await expect(run('new@example.com')).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: "You've just asked for a link. Please wait a few minutes before asking again.",
    });
    expect(sendEmailChangeConfirmation).not.toHaveBeenCalled();
  });

  it("doesn't use up the cooldown on a wrong password", async () => {
    await expect(run('new@example.com', 'Wrong-password1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(state.updates).toEqual([]);
  });
});
