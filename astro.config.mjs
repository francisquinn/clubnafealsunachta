// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://clubnafealsunachta.com',
  output: 'static',
  integrations: [react(), sitemap()],
  adapter: netlify(),
  security: {
    // Astro Actions default to a 1MB request body cap — below #70's own
    // 2MB avatar upload limit (AccountForm.tsx/actions/avatar.ts), so any
    // upload past ~1MB failed with "Request body exceeds 1048576 bytes"
    // (and took the rest of that Promise.all-shared FormData submission —
    // username, club settings — down with it, since they're one request).
    actionBodySizeLimit: 3 * 1024 * 1024, // 3MB: comfortable headroom over the 2MB avatar cap
  },
});