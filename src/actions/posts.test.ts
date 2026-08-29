import { describe, it, expect, vi, beforeEach } from 'vitest';

// Handler-level tests for createPost/updatePost, using the same harness as
// events.test.ts: defineAction/ActionError mocked from astro:actions,
// requireAdmin stubbed with a per-test admin scope (pure helpers kept real),
// supabaseAdmin mocked per table, and Mailchimp/Netlify mocked so nothing
// touches the network.
const state = vi.hoisted(() => {
  return {
    admin: null as { memberId: string; isSuperAdmin: boolean; clubIds: number[] } | null,
    // posts insert (createPost) - captured rows + error
    insertedPost: null as Record<string, unknown> | null,
    postInsertError: null as Error | null,
    // posts update (updatePost) - .eq('slug').select().single()
    postUpdateError: null as Error | null,
    postUpdateSlug: null as string | null,
    postUpdateResult: unknown,
  };
});

vi.mock('astro:actions', () => {
  class MockActionError extends Error {
    code: string;
    constructor(params: { message?: string; code: string }) {
      super(params.message);
      this.name = 'ActionError';
      this.code = params.code;
    }
  }
  return {
    defineAction: (definition: { accept?: string; handler: unknown }) => definition,
    ActionError: MockActionError,
  };
});

vi.mock('../lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth')>();
  return {
    ...actual,
    requireAdmin: () => state.admin,
  };
});

vi.mock('../lib/supabase', () => {
  return {
    supabaseAdmin: {
      from: (table: string) => {
        if (table !== 'posts') throw new Error(`unexpected table: ${table}`);
        return {
          insert: (rows: Record<string, unknown>[]) => {
            state.insertedPost = rows[0] ?? null;
            return Promise.resolve({ error: state.postInsertError });
          },
          update: () => ({
            eq: (column: string, value: string) => {
              if (column === 'slug') state.postUpdateSlug = value;
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: state.postUpdateResult,
                      error: state.postUpdateError,
                    }),
                }),
              };
            },
          }),
        };
      },
    },
  };
});

vi.mock('../lib/mailchimp', () => ({
  sendMailchimpPostEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/netlifyBuildHook', () => ({
  triggerNetlifyBuild: vi.fn(),
}));

import { createPost, updatePost } from './posts';
import { sendMailchimpPostEmail } from '../lib/mailchimp';
import { triggerNetlifyBuild } from '../lib/netlifyBuildHook';

const createAction = createPost as unknown as {
  handler: (formData: FormData, context: { request: Request }) => Promise<{ success: boolean }>;
};
const updateAction = updatePost as unknown as {
  handler: (formData: FormData, context: { request: Request }) => Promise<{ success: boolean }>;
};

const SUPER_ADMIN = { memberId: 'admin-1', isSuperAdmin: true, clubIds: [] };

function makeContext() {
  return { request: new Request('https://example.com/actions', { method: 'POST' }) };
}

function basePostFormData(): FormData {
  const formData = new FormData();
  formData.append('title', 'Hello World');
  formData.append('slug', 'hello-world');
  formData.append('date', '2026-09-01');
  formData.append('body', 'Some **markdown** body');
  return formData;
}

beforeEach(() => {
  state.admin = null;
  state.insertedPost = null;
  state.postInsertError = null;
  state.postUpdateError = null;
  state.postUpdateSlug = null;
  state.postUpdateResult = undefined;
  vi.mocked(sendMailchimpPostEmail).mockClear();
  vi.mocked(triggerNetlifyBuild).mockClear();
});

describe('createPost', () => {
  it('rejects with UNAUTHORIZED before touching any data when not an admin', async () => {
    await expect(createAction.handler(basePostFormData(), makeContext())).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(state.insertedPost).toBeNull();
  });

  it('rejects with BAD_REQUEST when required fields are missing', async () => {
    state.admin = SUPER_ADMIN;
    await expect(createAction.handler(new FormData(), makeContext())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects with BAD_REQUEST when the slug has invalid characters', async () => {
    state.admin = SUPER_ADMIN;
    const formData = basePostFormData();
    formData.set('slug', 'Hello World!');
    await expect(createAction.handler(formData, makeContext())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(state.insertedPost).toBeNull();
  });

  it('creates a post and fires the build hook and Mailchimp email', async () => {
    state.admin = SUPER_ADMIN;
    await expect(createAction.handler(basePostFormData(), makeContext())).resolves.toEqual({
      success: true,
    });
    expect(state.insertedPost).toMatchObject({
      title: 'Hello World',
      slug: 'hello-world',
      date: '2026-09-01',
      body: 'Some **markdown** body',
      author_id: 'admin-1',
    });
    expect(triggerNetlifyBuild).toHaveBeenCalledTimes(1);
    expect(sendMailchimpPostEmail).toHaveBeenCalledTimes(1);
    expect(sendMailchimpPostEmail).toHaveBeenCalledWith({
      title: 'Hello World',
      slug: 'hello-world',
      body: 'Some **markdown** body',
    });
  });

  it('rejects with BAD_REQUEST when the slug already exists (unique violation)', async () => {
    state.admin = SUPER_ADMIN;
    state.postInsertError = Object.assign(new Error('duplicate'), { code: '23505' });
    await expect(createAction.handler(basePostFormData(), makeContext())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects with INTERNAL_SERVER_ERROR on an unexpected insert error', async () => {
    state.admin = SUPER_ADMIN;
    state.postInsertError = new Error('boom');
    await expect(createAction.handler(basePostFormData(), makeContext())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});

describe('updatePost', () => {
  it('rejects with UNAUTHORIZED when not an admin', async () => {
    await expect(updateAction.handler(basePostFormData(), makeContext())).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects with BAD_REQUEST when required fields are missing', async () => {
    state.admin = SUPER_ADMIN;
    await expect(updateAction.handler(new FormData(), makeContext())).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('updates a post and fires the build hook', async () => {
    state.admin = SUPER_ADMIN;
    state.postUpdateResult = { slug: 'hello-world' };
    await expect(updateAction.handler(basePostFormData(), makeContext())).resolves.toEqual({
      success: true,
    });
    expect(state.postUpdateSlug).toBe('hello-world');
    expect(triggerNetlifyBuild).toHaveBeenCalledTimes(1);
  });

  it('rejects with NOT_FOUND when no post row comes back', async () => {
    state.admin = SUPER_ADMIN;
    state.postUpdateResult = null;
    await expect(updateAction.handler(basePostFormData(), makeContext())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('rejects with INTERNAL_SERVER_ERROR when the update fails', async () => {
    state.admin = SUPER_ADMIN;
    state.postUpdateError = new Error('boom');
    await expect(updateAction.handler(basePostFormData(), makeContext())).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});
