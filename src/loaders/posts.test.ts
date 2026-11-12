import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postsLoader } from './posts';

const { mockSupabaseAdmin } = vi.hoisted(() => ({
  mockSupabaseAdmin: { from: vi.fn() },
}));

vi.mock('../lib/supabase', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

function servePosts(posts: unknown[]) {
  mockSupabaseAdmin.from.mockImplementation((table: string) => {
    if (table !== 'posts') throw new Error(`Unexpected table: ${table}`);
    return { select: () => ({ order: () => Promise.resolve({ data: posts, error: null }) }) };
  });
}

const basePost = {
  title: 'A post',
  date: '2026-11-01',
  body: 'Body',
  cover_image_url: null,
};

async function load() {
  const store = { clear: vi.fn(), set: vi.fn() };
  const renderMarkdown = vi.fn(async (body: string) => ({ html: body }));
  await postsLoader().load({ store, renderMarkdown } as any);
  return store;
}

describe('postsLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores a post with its author', async () => {
    const author = { id: 'user-1', username: 'alice', full_name: null, display_full_name: false, avatar_url: null };
    servePosts([{ ...basePost, slug: 'with-author', author_id: 'user-1', members: author }]);

    const store = await load();

    expect(store.set).toHaveBeenCalledTimes(1);
    expect(store.set.mock.calls[0]?.[0]?.data.author).toEqual(author);
  });

  // #210: an author who deleted their account leaves author_id null; the post
  // stays up with no author ("Former member").
  it('keeps a post whose author deleted their account, with no author', async () => {
    servePosts([{ ...basePost, slug: 'authorless', author_id: null, members: null }]);

    const store = await load();

    expect(store.set).toHaveBeenCalledTimes(1);
    expect(store.set.mock.calls[0]?.[0]?.data.author).toBeNull();
  });

  it('still skips a post whose author row is missing', async () => {
    servePosts([{ ...basePost, slug: 'broken', author_id: 'user-9', members: null }]);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const store = await load();

    expect(store.set).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Skipping post "broken": no matching member for author_id user-9');
    consoleError.mockRestore();
  });
});
