import { ActionError } from 'astro:actions';
import type { SupabaseClient } from '@supabase/supabase-js';

// #94: the create forms (events/posts/books) pre-fill the slug from a title
// the admin doesn't necessarily control for uniqueness — rather than
// rejecting a collision, append -2, -3, ... until a free slug in `table`
// is found.
export async function resolveUniqueSlug(
  client: SupabaseClient,
  table: string,
  baseSlug: string
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;
  while (true) {
    const { data, error } = await client.from(table).select('id').eq('slug', candidate).maybeSingle();
    if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    if (!data) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}
