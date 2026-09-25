import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const state = vi.hoisted(() => ({
  uploads: [] as { bucket: string; key: string; contentType: string; size: number }[],
  uploadError: null as Error | null,
}));

vi.mock('astro:actions', () => {
  class MockActionError extends Error {
    code: string;
    constructor(params: { message?: string; code: string }) {
      super(params.message);
      this.code = params.code;
    }
  }
  return { ActionError: MockActionError };
});

vi.mock('./supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: (bucket: string) => ({
        upload: (key: string, file: Blob, opts: { contentType: string }) => {
          state.uploads.push({ bucket, key, contentType: opts.contentType, size: file.size });
          return Promise.resolve({ error: state.uploadError });
        },
        getPublicUrl: (key: string) => ({
          data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${key}` },
        }),
      }),
    },
  },
}));

import { uploadImageIfPresent, resizedImageUrl } from './storageUpload';

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const LIMITS = { label: 'Cover image', maxBytes: 100, resizeWidth: 1600 };

function formWith(file: File | null): FormData {
  const formData = new FormData();
  formData.append('cover_image', file ?? new File([], ''));
  return formData;
}

function jpeg(size = JPEG_BYTES.length): File {
  const bytes = new Uint8Array(size);
  bytes.set(JPEG_BYTES);
  return new File([bytes], 'cover.jpg', { type: 'image/jpeg' });
}

const fetchMock = vi.fn();

beforeEach(() => {
  state.uploads = [];
  state.uploadError = null;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resizedImageUrl', () => {
  it('points a public object URL at the render endpoint with the width', () => {
    expect(resizedImageUrl('https://x.supabase.co/storage/v1/object/public/post-covers/a', 1600)).toBe(
      'https://x.supabase.co/storage/v1/render/image/public/post-covers/a?width=1600&resize=contain'
    );
  });

  it('leaves any other URL untouched', () => {
    expect(resizedImageUrl('/about.jpg', 1600)).toBe('/about.jpg');
  });
});

describe('uploadImageIfPresent', () => {
  it('returns null and uploads nothing when no file was chosen', async () => {
    await expect(uploadImageIfPresent(formWith(null), 'cover_image', 'post-covers', 'a', LIMITS)).resolves.toBeNull();
    expect(state.uploads).toHaveLength(0);
  });

  it('uploads without checks or resizing when no limits are given', async () => {
    const file = new File(['not really an image'], 'x.txt', { type: 'text/plain' });
    await uploadImageIfPresent(formWith(file), 'cover_image', 'book-covers', 'a');
    expect(state.uploads).toEqual([{ bucket: 'book-covers', key: 'a', contentType: 'text/plain', size: file.size }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a file over the size cap before uploading', async () => {
    await expect(uploadImageIfPresent(formWith(jpeg(101)), 'cover_image', 'post-covers', 'a', LIMITS)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('Cover image must be'),
    });
    expect(state.uploads).toHaveLength(0);
  });

  it('rejects a file that is not really an image, whatever its claimed type', async () => {
    const fake = new File(['<svg><script></script></svg>'], 'x.jpg', { type: 'image/jpeg' });
    await expect(uploadImageIfPresent(formWith(fake), 'cover_image', 'post-covers', 'a', LIMITS)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(state.uploads).toHaveLength(0);
  });

  it('re-stores the resized copy over the original', async () => {
    fetchMock.mockResolvedValue(new Response(new Blob([new Uint8Array(5)], { type: 'image/jpeg' })));
    const url = await uploadImageIfPresent(formWith(jpeg()), 'cover_image', 'post-covers', 'a', LIMITS);
    expect(url).toBe('https://x.supabase.co/storage/v1/object/public/post-covers/a');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://x.supabase.co/storage/v1/render/image/public/post-covers/a?width=1600&resize=contain'
    );
    expect(state.uploads.map((u) => u.size)).toEqual([JPEG_BYTES.length, 5]);
  });

  it('keeps the original when the resize request fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(uploadImageIfPresent(formWith(jpeg()), 'cover_image', 'post-covers', 'a', LIMITS)).resolves.toBeTruthy();
    expect(state.uploads).toHaveLength(1);
    spy.mockRestore();
  });

  it('throws INTERNAL_SERVER_ERROR when the upload itself fails', async () => {
    state.uploadError = new Error('bucket missing');
    await expect(uploadImageIfPresent(formWith(jpeg()), 'cover_image', 'post-covers', 'a', LIMITS)).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});
