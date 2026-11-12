import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Handler-level tests for deleteAccount (#210). verifySession is mocked (its
// own tests live in lib/auth.test.ts); password hashing stays real.
const state = vi.hoisted(() => ({
  session: null as { memberId: string; isAdmin: boolean; username: string } | null,
  member: null as { password_hash: string; is_admin: boolean; avatar_url: string | null } | null,
  otherAdmins: 0,
  authoredPosts: 0,
  authoredEvents: 0,
  deletedRows: [{ id: 'm1' }] as { id: string }[],
  deleteError: null as { message: string } | null,
  deleteFilters: [] as unknown[][],
  removed: [] as string[][],
  removeError: null as { message: string } | null,
  memberUpdates: [] as Record<string, unknown>[],
  buildTriggered: 0,
}));

vi.mock('astro:actions', async () => (await import('../test/astroActions')).mockActionModule());

vi.mock('../lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/auth')>()),
  verifySession: () => Promise.resolve(state.session),
}));

vi.mock('../lib/netlifyBuildHook', () => ({
  triggerNetlifyBuild: () => {
    state.buildTriggered += 1;
    return Promise.resolve();
  },
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
              state.memberUpdates.push(update.args[0] as Record<string, unknown>);
              return { data: null, error: null };
            }
            if (calls.some((c) => c.method === 'delete')) {
              state.deleteFilters.push(...calls.filter((c) => c.method === 'eq').map((c) => c.args));
              return { data: state.deleteError ? null : state.deletedRows, error: state.deleteError };
            }
            if (calls.some((c) => c.method === 'neq')) return { data: null, count: state.otherAdmins, error: null } as never;
            return { data: state.member, error: null };
          }),
        posts: () => stubQuery(() => ({ data: null, count: state.authoredPosts, error: null }) as never),
        events: () => stubQuery(() => ({ data: null, count: state.authoredEvents, error: null }) as never),
      }),
      storage: {
        from: () => ({
          remove: (paths: string[]) => {
            state.removed.push(paths);
            return Promise.resolve({ data: state.removeError ? null : [], error: state.removeError });
          },
        }),
      },
    },
  };
});

import { deleteAccount } from './deleteAccount';
import { hashPassword } from '../lib/auth';

type Handler = (formData: FormData, context: unknown) => Promise<{ success: boolean }>;
const handler = (deleteAccount as unknown as { handler: Handler }).handler;

const PASSWORD = 'My-password1';
const PHOTO = 'https://x.supabase.co/storage/v1/object/public/avatars/m1';
let hash: string;

beforeAll(async () => {
  hash = await hashPassword(PASSWORD);
});

beforeEach(() => {
  state.session = { memberId: 'm1', isAdmin: false, username: 'alice' };
  state.member = { password_hash: hash, is_admin: false, avatar_url: PHOTO };
  state.otherAdmins = 0;
  state.authoredPosts = 0;
  state.authoredEvents = 0;
  state.deletedRows = [{ id: 'm1' }];
  state.deleteError = null;
  state.deleteFilters = [];
  state.removed = [];
  state.removeError = null;
  state.memberUpdates = [];
  state.buildTriggered = 0;
});

function run(password: string) {
  const fd = new FormData();
  fd.set('password', password);
  const del = vi.fn();
  const context = { cookies: { get: () => ({ value: 'token' }), delete: del } };
  return { result: handler(fd, context), del };
}

describe('deleteAccount', () => {
  it('rejects a signed-out request', async () => {
    state.session = null;
    await expect(run(PASSWORD).result).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(state.deleteFilters).toEqual([]);
  });

  it('rejects a wrong password and deletes nothing', async () => {
    const { result, del } = run('Wrong-password1');
    await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Password is incorrect' });
    expect(state.deleteFilters).toEqual([]);
    expect(del).not.toHaveBeenCalled();
  });

  it('deletes the member, guarded on the checked hash, removes the photo and clears the cookies', async () => {
    const { result, del } = run(PASSWORD);
    await expect(result).resolves.toEqual({ success: true });

    expect(state.deleteFilters).toEqual([['id', 'm1'], ['password_hash', hash]]);
    expect(state.removed).toEqual([['m1']]);
    expect(del.mock.calls.map((c) => c[0])).toEqual(['session', 'cnf_logged_in', 'cnf_avatar_hint']);
    // Nothing authored, so no static page shows them.
    expect(state.buildTriggered).toBe(0);
  });

  it('rebuilds the site when the member hosted events', async () => {
    state.authoredEvents = 2;
    await expect(run(PASSWORD).result).resolves.toEqual({ success: true });
    expect(state.buildTriggered).toBe(1);
  });

  it('rebuilds the site when the member wrote posts but hosted no events', async () => {
    state.authoredPosts = 1;
    await expect(run(PASSWORD).result).resolves.toEqual({ success: true });
    expect(state.buildTriggered).toBe(1);
  });

  it('fails without clearing cookies when the password changed in the meantime, and drops the removed photo', async () => {
    state.deletedRows = [];
    const { result, del } = run(PASSWORD);
    await expect(result).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(del).not.toHaveBeenCalled();
    // The photo went before the delete, so the account no longer points at it.
    expect(state.removed).toEqual([['m1']]);
    expect(state.memberUpdates).toEqual([{ avatar_url: null }]);
  });

  it('deletes nothing when the photo cannot be removed', async () => {
    state.removeError = { message: 'storage down' };
    const { result, del } = run(PASSWORD);
    await expect(result).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(state.deleteFilters).toEqual([]);
    expect(del).not.toHaveBeenCalled();
  });

  it('skips storage for a member without a photo', async () => {
    state.member = { password_hash: hash, is_admin: false, avatar_url: null };
    await expect(run(PASSWORD).result).resolves.toEqual({ success: true });
    expect(state.removed).toEqual([]);
  });

  it("refuses to delete the only site admin", async () => {
    state.member = { password_hash: hash, is_admin: true, avatar_url: null };
    await expect(run(PASSWORD).result).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(state.deleteFilters).toEqual([]);
  });

  it('lets a site admin delete their account when another admin remains', async () => {
    state.member = { password_hash: hash, is_admin: true, avatar_url: null };
    state.otherAdmins = 1;
    await expect(run(PASSWORD).result).resolves.toEqual({ success: true });
  });
});
