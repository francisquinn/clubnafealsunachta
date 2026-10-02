import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerNetlifyBuild } from './netlifyBuildHook';

describe('triggerNetlifyBuild', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs non-success responses without rejecting', async () => {
    vi.stubEnv('NETLIFY_BUILD_HOOK_URL', 'https://example.com/build-hook');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(triggerNetlifyBuild()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('Netlify build hook failed with HTTP 503');
  });

  it('logs request failures without rejecting', async () => {
    vi.stubEnv('NETLIFY_BUILD_HOOK_URL', 'https://example.com/build-hook');
    const fetchError = new Error('network unavailable');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(fetchError));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(triggerNetlifyBuild()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('Netlify build hook failed:', fetchError);
  });

  it('does nothing when the build hook URL is not configured', async () => {
    vi.stubEnv('NETLIFY_BUILD_HOOK_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(triggerNetlifyBuild()).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
