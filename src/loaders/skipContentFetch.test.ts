import { describe, it, expect, vi, afterEach } from 'vitest';
import { postsLoader } from './posts';
import { booksLoader } from './books';
import { eventsLoader } from './events';

const { mockSupabaseAdmin } = vi.hoisted(() => ({
  mockSupabaseAdmin: { from: vi.fn() },
}));

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

describe.each([
  ['postsLoader', postsLoader],
  ['booksLoader', booksLoader],
  ['eventsLoader', eventsLoader],
])('%s skip flag', (_name, makeLoader) => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('skips Supabase and clears the store when SKIP_CONTENT_FETCH is 1', async () => {
    vi.stubEnv('SKIP_CONTENT_FETCH', '1');
    const store = { clear: vi.fn(), set: vi.fn() };

    await makeLoader().load({ store } as any);

    expect(store.clear).toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
    expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
  });
});
