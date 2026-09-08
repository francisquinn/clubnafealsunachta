import { describe, it, expect, vi, beforeEach } from 'vitest';

// Handler-level test for signup. defineAction/ActionError mocked from
// astro:actions as in the other action harnesses, and createAccount (the only
// real work signup delegates to) is mocked so this test focuses on the
// handler wiring: it calls createAccount with isAdmin=false and the request
// origin, and propagates failures.
const state = vi.hoisted(() => {
  return {
    origin: 'https://example.com',
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

vi.mock('../lib/memberAccount', () => ({
  createAccount: vi.fn().mockResolvedValue(undefined),
}));

import { signup } from './signup';
import { createAccount } from '../lib/memberAccount';

const action = signup as unknown as {
  handler: (formData: FormData, context: { url: URL }) => Promise<{ success: boolean }>;
};

function makeContext() {
  return { url: new URL(state.origin) };
}

beforeEach(() => {
  state.origin = 'https://example.com';
  vi.mocked(createAccount).mockClear();
});

describe('signup', () => {
  it('creates a non-admin account from the form with the request origin', async () => {
    const formData = new FormData();
    formData.append('username', 'neo');
    formData.append('email', 'neo@example.com');
    formData.append('password', 'hunter2!Password');
    formData.append('confirm_password', 'hunter2!Password');

    await expect(action.handler(formData, makeContext())).resolves.toEqual({ success: true });

    expect(createAccount).toHaveBeenCalledTimes(1);
    expect(createAccount).toHaveBeenCalledWith(formData, false, state.origin);
  });

  it('propagates an ActionError thrown by createAccount', async () => {
    vi.mocked(createAccount).mockRejectedValueOnce(
      Object.assign(new Error('taken'), { code: 'CONFLICT' })
    );

    const formData = new FormData();
    formData.append('username', 'neo');
    formData.append('email', 'neo@example.com');
    formData.append('password', 'hunter2!Password');
    formData.append('confirm_password', 'hunter2!Password');

    await expect(action.handler(formData, makeContext())).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});
