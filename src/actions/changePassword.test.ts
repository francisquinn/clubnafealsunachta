import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Handler-level tests for changePassword. verifySession is mocked (its own
// tests live in lib/auth.test.ts); hashing, token signing and the revocation
// check stay real, so a fresh session can be checked against the new cutoff.
const state = vi.hoisted(() => ({
  session: null as { memberId: string; isAdmin: boolean; username: string } | null,
  member: null as { password_hash: string } | null,
  updateError: null as { message: string } | null,
  updatedRows: [{ id: 'm1' }] as { id: string }[],
  updates: [] as Record<string, unknown>[],
  updateFilters: [] as unknown[][],
}));

vi.mock('astro:actions', async () => (await import('../test/astroActions')).mockActionModule());

vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/auth')>()),
  verifySession: () => Promise.resolve(state.session),
}));

vi.mock('../lib/supabase', async () => {
  const { stubFrom, stubQuery } = await import('../test/supabaseStub');
  return {
    supabaseAdmin: {
      from: stubFrom({
        members: () =>
          stubQuery((calls) => {
            const update = calls.find((c) => c.method === 'update');
            if (!update) return { data: state.member, error: null };
            state.updates.push(update.args[0] as Record<string, unknown>);
            state.updateFilters.push(...calls.filter((c) => c.method === 'eq').map((c) => c.args));
            return { data: state.updateError ? null : state.updatedRows, error: state.updateError };
          }),
      }),
    },
  };
});

import { changePassword } from './changePassword';
import { hashPassword, verifyPassword, verifySessionToken, isSessionRevoked } from '../lib/auth';

process.env.JWT_SECRET ??= 'test-secret';

type Handler = (formData: FormData, context: unknown) => Promise<{ success: boolean }>;
const handler = (changePassword as unknown as { handler: Handler }).handler;

const CURRENT = 'Old-password1';
const NEW = 'New-password2';
let oldHash: string;

beforeAll(async () => {
  oldHash = await hashPassword(CURRENT);
});

beforeEach(() => {
  state.session = { memberId: 'm1', isAdmin: false, username: 'alice' };
  state.member = { password_hash: oldHash };
  state.updateError = null;
  state.updatedRows = [{ id: 'm1' }];
  state.updates = [];
  state.updateFilters = [];
});

function run(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const set = vi.fn();
  const context = { cookies: { get: () => ({ value: 'token' }), set } };
  return { result: handler(fd, context), set };
}

const valid = { current_password: CURRENT, new_password: NEW, confirm_password: NEW };

describe('changePassword', () => {
  it('rejects a wrong current password and changes nothing', async () => {
    const { result, set } = run({ ...valid, current_password: 'Wrong-password1' });
    await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
    expect(state.updates).toEqual([]);
    expect(set).not.toHaveBeenCalled();
  });

  it('saves the new password and revokes sessions issued before now', async () => {
    const before = Date.now();
    const { result } = run(valid);
    await expect(result).resolves.toEqual({ success: true });

    expect(state.updates).toHaveLength(1);
    const update = state.updates[0]!;
    expect(await verifyPassword(NEW, update.password_hash as string)).toBe(true);
    expect(new Date(update.sessions_valid_after as string).getTime()).toBeGreaterThanOrEqual(before);
    // A session issued a second before the change no longer counts.
    expect(isSessionRevoked(Math.floor(before / 1000) - 1, update.sessions_valid_after as string)).toBe(true);
  });

  it('keeps the current session valid with a fresh session cookie', async () => {
    const { result, set } = run(valid);
    await result;

    expect(set).toHaveBeenCalledWith('session', expect.any(String), expect.objectContaining({ httpOnly: true }));
    const token = set.mock.calls.find((c) => c[0] === 'session')![1] as string;
    const payload = verifySessionToken(token);
    expect(payload).toMatchObject({ memberId: 'm1', isAdmin: false, username: 'alice' });
    expect(isSessionRevoked(payload!.iat, state.updates[0]!.sessions_valid_after as string)).toBe(false);
  });

  it('rejects an unauthenticated request', async () => {
    state.session = null;
    await expect(run(valid).result).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  });

  it('rejects missing fields, a weak password and a mismatched confirmation', async () => {
    await expect(run({ ...valid, confirm_password: '' }).result).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(run({ ...valid, new_password: 'short', confirm_password: 'short' }).result).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(run({ ...valid, confirm_password: 'Other-password3' }).result).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Passwords do not match',
    });
    expect(state.updates).toEqual([]);
  });

  it('only updates if the password has not changed since it was checked', async () => {
    await run(valid).result;
    expect(state.updateFilters).toContainEqual(['password_hash', oldHash]);

    state.updatedRows = [];
    const { result, set } = run(valid);
    await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
    expect(set).not.toHaveBeenCalled();
  });

  it('reports a failed update without setting a new session', async () => {
    state.updateError = { message: 'boom' };
    const { result, set } = run(valid);
    await expect(result).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(set).not.toHaveBeenCalled();
  });
});
