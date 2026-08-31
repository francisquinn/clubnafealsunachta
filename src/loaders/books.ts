import type { Loader } from 'astro/loaders';
import { supabaseAdmin } from '../lib/supabase';

export function booksLoader(): Loader {
  return {
    name: 'books',
    load: async ({ store, renderMarkdown }) => {
      if (!supabaseAdmin) {
        throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_SECRET_KEY');
      }

      store.clear();

      const { data, error } = await supabaseAdmin
        .from('books')
        .select('title, author, slug, blurb, cover_image_url')
        .order('id', { ascending: true });

      // #30: tolerated rather than fatal when the books table isn't deployed
      // yet (same tradeoff as the RSVP build-time counts) — a
      // migration-pending build shouldn't take the whole site down, and the
      // reading page just shows an empty list until books exist.
      if (error) {
        console.error(`Failed to fetch books from Supabase: ${error.message}`);
        return;
      }

      for (const book of data || []) {
        const rendered = await renderMarkdown(book.blurb);
        store.set({
          id: book.slug,
          data: {
            title: book.title,
            author: book.author,
            blurb: book.blurb,
            coverImageUrl: book.cover_image_url,
          },
          body: book.blurb,
          rendered,
        });
      }
    },
  };
}