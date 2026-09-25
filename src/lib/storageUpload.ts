import { ActionError } from 'astro:actions';
import { supabaseAdmin } from './supabase';
import { sniffImageType } from './imageType';

const OBJECT_URL_MARKER = '/storage/v1/object/public/';
const RENDER_URL_SEGMENT = '/storage/v1/render/image/public/';

type UploadLimits = {
  // Shown in error messages, e.g. "Cover image must be 5MB or smaller".
  label: string;
  maxBytes: number;
  // Stored copy is re-rendered to this width (aspect ratio kept) in place of
  // the original, same approach as actions/avatar.ts.
  resizeWidth: number;
};

// Supabase's render endpoint for a public object URL, scaled to `width` with
// height following the aspect ratio. Falls back to the URL untouched if it
// isn't a public object URL (not expected in practice).
export function resizedImageUrl(publicUrl: string, width: number): string {
  const markerIndex = publicUrl.indexOf(OBJECT_URL_MARKER);
  if (markerIndex === -1) return publicUrl;
  return (
    publicUrl.slice(0, markerIndex) +
    RENDER_URL_SEGMENT +
    publicUrl.slice(markerIndex + OBJECT_URL_MARKER.length) +
    `?width=${width}&resize=contain`
  );
}

// Uploads the image in a form's file field to a public bucket, keyed by the
// record's slug (upsert: a re-upload on edit just overwrites the same object
// instead of leaving the old file orphaned). Returns the public URL, or null
// if no file was actually chosen — an empty file input still shows up in
// FormData, just with size 0.
//
// With `limits`, the file is also size-capped, type-checked by its magic
// bytes (file.type is client-supplied and spoofable — see lib/imageType.ts),
// and re-stored at a reduced width.
export async function uploadImageIfPresent(
  formData: FormData,
  field: string,
  bucket: string,
  slug: string,
  limits?: UploadLimits
): Promise<string | null> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  let contentType = file.type;
  if (limits) {
    if (file.size > limits.maxBytes) {
      throw new ActionError({
        code: 'BAD_REQUEST',
        message: `${limits.label} must be ${limits.maxBytes / (1024 * 1024)}MB or smaller`,
      });
    }
    const sniffedType = sniffImageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()));
    if (!sniffedType) {
      throw new ActionError({ code: 'BAD_REQUEST', message: `${limits.label} must be a JPEG, PNG, GIF, or WEBP image` });
    }
    contentType = sniffedType;
  }

  const { error } = await supabaseAdmin!.storage
    .from(bucket)
    .upload(slug, file, { upsert: true, contentType });

  if (error) {
    throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: `Image upload failed: ${error.message}` });
  }

  const { data } = supabaseAdmin!.storage.from(bucket).getPublicUrl(slug);

  // Best-effort, like the avatar re-store: if the resize fails the original
  // stays in place rather than failing the whole save.
  if (limits) {
    try {
      const resizeResponse = await fetch(resizedImageUrl(data.publicUrl, limits.resizeWidth));
      if (resizeResponse.ok) {
        const resizedBlob = await resizeResponse.blob();
        await supabaseAdmin!.storage
          .from(bucket)
          .upload(slug, resizedBlob, { upsert: true, contentType: resizedBlob.type || contentType });
      } else {
        console.error(`${limits.label} resize failed with HTTP ${resizeResponse.status} (keeping original)`);
      }
    } catch (err) {
      console.error(`${limits.label} resize failed (keeping original):`, err);
    }
  }

  return data.publicUrl;
}
