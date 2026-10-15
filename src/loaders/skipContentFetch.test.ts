import { describe, it, expect, vi, afterEach } from 'vitest';
import { postsLoader } from './posts';
import { booksLoader } from './books';
import { eventsLoader } from './events';

const { mockSupabaseAdmin, state } = vi.hoisted(() => ({
  mockSupabaseAdmin: { from: vi.fn() },
  state: { configured: true },
}));

vi.mock('../lib/supabase', () => ({
  get supabaseAdmin() {
    return state.configured ? mockSupabaseAdmin : null;
  },
}));

describe.each([
  ['postsLoader', postsLoader],
  ['booksLoader', booksLoader],
  ['eventsLoader', eventsLoader],
])('%s skip flag', (_name, makeLoader) => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    state.configured = true;
  });

  it('skips Supabase and clears the store when SKIP_CONTENT_FETCH is 1', async () => {
    vi.stubEnv('SKIP_CONTENT_FETCH', '1');
    const store = { clear: vi.fn(), set: vi.fn() };

    await makeLoader().load({ store } as any);

    expect(store.clear).toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
    expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
  });

  it('still requires Supabase when SKIP_CONTENT_FETCH is unset', async () => {
    vi.stubEnv('SKIP_CONTENT_FETCH', '');
    state.configured = false;
    const store = { clear: vi.fn(), set: vi.fn() };

    await expect(makeLoader().load({ store } as any)).rejects.toThrow('Supabase is not configured');
    expect(store.clear).not.toHaveBeenCalled();
  });
});
