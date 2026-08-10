# Club na Fealsúnachta

Website for Club na Fealsúnachta, a philosophical discussion club based in Trieste.

Built with [Astro](https://astro.build), [React](https://react.dev), and [Supabase](https://supabase.com). Deployed on [Netlify](https://netlify.com).

## Features

- Events listing and detail pages
- Blog
- Newsletter signup (Mailchimp)
- Member accounts (registration, email verification, profile editing, password change)
- Admin console for managing posts and events
- Contact and topic suggestion forms
- Privacy policy page

## Local Development

### Prerequisites

- Node.js 18+
- A Supabase project (see `supabase/schema.sql` for the schema)
- A Mailchimp account (for newsletter functionality)
- A Netlify site (for `npm run sync-env`, see below)

### Setup

```bash
npm install
```

Pull environment variables from Netlify into a local `.env` (requires the Netlify CLI logged into an account with access to this site):

```bash
npm run sync-env
```

### Run

```bash
npm run dev
```

### Test

```bash
npm test
```

## Project Structure

```
src/
  actions/       # Astro server actions
  components/    # Astro and React components
  layouts/       # Page layouts
  lib/           # Supabase client, auth, email helpers
  loaders/       # Astro content loaders (events, posts)
  pages/         # File-based routes
  styles/        # Global CSS
  types/         # TypeScript types
  utils/         # Shared utilities
  middleware.ts  # Session-token auth, CSRF trusted-origin checks, admin-route gating
supabase/
  schema.sql     # Database schema
scripts/
  sync-env.mjs   # Pulls env vars from Netlify into .env
```
