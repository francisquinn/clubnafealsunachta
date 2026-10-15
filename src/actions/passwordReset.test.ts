import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Handler-level tests for the forgot-password flow. defineAction/ActionError
// are mocked as in the other action harnesses; supabase is a small stub of the
// `.from().select().eq().single()` / `.update().eq().eq().select()` chains and
// the email sender is mocked so we can assert when a link is (not) sent.
const state = vi.hoisted(() => ({
  member: null as { id: string; password_hash: string; email_verified_at: string | null } | null,
  updateRows: [{ id: 'member-1' }] as { id: string }[],
  update: vi.fn(),
}));

vi.mock('astro:actions', async () => (await import('../test/astroActions')).mockActionModule());

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.member }) }) }),
      update: (values: unknown) => {
        state.update(values);
        const chain = {
          eq: () => chain,
          select: () => Promise.resolve({ data: state.updateRows, error: null }),
        };
        return chain;
      },
    }),
  },
}));

vi.mock('../lib/passwordResetEmail', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { requestPasswordReset, resetPassword } from './passwordReset';
import { sendPasswordResetEmail } from '../lib/passwordResetEmail';
import { createPasswordResetToken } from '../lib/auth';

type Handler = (formData: FormData, context: { url: URL; site?: URL }) => Promise<{ success: boolean }>;
const request = (requestPasswordReset as unknown as { handler: Handler }).handler;
const reset = (resetPassword as unknown as { handler: Handler }).handler;

const context = { url: new URL('https://example.com/forgot-password') };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  vi.clearAllMocks();
  state.member = { id: 'member-1', password_hash: 'salt:old', email_verified_at: '2026-01-01' };
  state.updateRows = [{ id: 'member-1' }];
});

describe('requestPasswordReset', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Runs the handler to completion under fake timers, returning how much
  // (fake) time it took.
  async function timed(email: string) {
    const start = Date.now();
    const promise = request(form({ email }), context);
    await vi.runAllTimersAsync();
    const result = await promise;
    return { result, elapsed: Date.now() - start };
  }

  it('takes the same minimum time whether or not an email is sent', async () => {
    const known = await timed('me@example.com');
    state.member = null;
    const unknown = await timed('nobody@example.com');
    expect(known.elapsed).toBeGreaterThanOrEqual(1500);
    expect(unknown.elapsed).toBe(known.elapsed);
  });

  it('sends a reset email to a verified member', async () => {
    expect((await timed(' Me@Example.com ')).result).toEqual({ success: true });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('me@example.com', 'member-1', 'salt:old', 'https://example.com');
  });

  it('links to the configured site in production, ignoring the request host', async () => {
    vi.stubEnv('PROD', true);
    try {
      const evil = { url: new URL('https://evil.example/forgot-password'), site: new URL('https://clubnafealsunachta.com') };
      const promise = request(form({ email: 'me@example.com' }), evil);
      await vi.runAllTimersAsync();
      await promise;
      expect(sendPasswordResetEmail).toHaveBeenCalledWith('me@example.com', 'member-1', 'salt:old', 'https://clubnafealsunachta.com');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('succeeds without sending for an unknown email', async () => {
    state.member = null;
    expect((await timed('nobody@example.com')).result).toEqual({ success: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('succeeds without sending for an unverified member', async () => {
    state.member = { id: 'member-1', password_hash: 'salt:old', email_verified_at: null };
    expect((await timed('me@example.com')).result).toEqual({ success: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('still succeeds when the email fails to send', async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('smtp down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await timed('me@example.com')).result).toEqual({ success: true });
  });

  it('rejects a malformed email', async () => {
    await expect(request(form({ email: 'nope' }), context)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('resetPassword', () => {
  const good = { new_password: 'Newpassword1', confirm_password: 'Newpassword1' };

  it('updates the password with a valid token', async () => {
    const token = createPasswordResetToken('member-1', 'salt:old');
    await expect(reset(form({ token, ...good }), context)).resolves.toEqual({ success: true });
    expect(state.update).toHaveBeenCalledTimes(1);
  });

  it('rejects a token issued against a previous password (already used)', async () => {
    const token = createPasswordResetToken('member-1', 'salt:older');
    await expect(reset(form({ token, ...good }), context)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(state.update).not.toHaveBeenCalled();
  });

  it('rejects when a concurrent request already changed the password', async () => {
    state.updateRows = [];
    const token = createPasswordResetToken('member-1', 'salt:old');
    await expect(reset(form({ token, ...good }), context)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a garbage token', async () => {
    await expect(reset(form({ token: 'garbage', ...good }), context)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('enforces password rules and matching', async () => {
    const token = createPasswordResetToken('member-1', 'salt:old');
    await expect(reset(form({ token, new_password: 'weak', confirm_password: 'weak' }), context)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(reset(form({ token, new_password: 'Newpassword1', confirm_password: 'Different1' }), context)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(state.update).not.toHaveBeenCalled();
  });
});
