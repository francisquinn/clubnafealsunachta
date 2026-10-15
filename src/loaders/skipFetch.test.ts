import { describe, it, expect, afterEach, vi } from 'vitest';
import { shouldSkipContentFetch } from './skipFetch';

describe('shouldSkipContentFetch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true only for exactly "1"', () => {
    vi.stubEnv('SKIP_CONTENT_FETCH', '1');
    expect(shouldSkipContentFetch()).toBe(true);
    vi.stubEnv('SKIP_CONTENT_FETCH', 'true');
    expect(shouldSkipContentFetch()).toBe(false);
    vi.stubEnv('SKIP_CONTENT_FETCH', '');
    expect(shouldSkipContentFetch()).toBe(false);
  });

  it('throws when the flag is set on Netlify', () => {
    vi.stubEnv('SKIP_CONTENT_FETCH', '1');
    vi.stubEnv('NETLIFY', 'true');
    expect(() => shouldSkipContentFetch()).toThrow('SKIP_CONTENT_FETCH is set on Netlify');
  });
});
