import type { Loader } from 'astro/loaders';
import { supabaseAdmin } from '../lib/supabase';

export function postsLoader(): Loader {
  return {
    name: 'posts',
    load: async ({ store, renderMarkdown }) => {
      if (!supabaseAdmin) {
        throw new Error('Supabase is not configured — set SUPABASE_PROJECT_URL and SUPABASE_SECRET_KEY');
      }

      store.clear();

      const { data, error } = await supabaseAdmin
        .from('posts')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch posts from Supabase: ${error.message}`);
      }

      for (const post of data || []) {
        const rendered = await renderMarkdown(post.body);
        store.set({
          id: post.slug,
          data: {
            title: post.title,
            date: new Date(post.date),
            author: post.author,
          },
          body: post.body,
          rendered,
        });
      }
    },
  };
}
