# Club na Fealsúnachta

Website for Club na Fealsúnachta, a philosophical discussion club based in Trieste.

Built with [Astro](https://astro.build), [React](https://react.dev), and [Supabase](https://supabase.com). Deployed on [Netlify](https://netlify.com).

## Features

- Events listing and detail pages
- Blog
- Newsletter signup (Mailchimp)
- Admin console for managing posts and events
- Contact and topic suggestion forms

## Local Development

### Prerequisites

- Node.js 18+
- A Supabase project (see `supabase/schema.sql` for the schema)
- A Mailchimp account (for newsletter functionality)

### Setup

```bash
npm install
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
  actions/     # Astro server actions
  components/  # Astro and React components
  layouts/     # Page layouts
  lib/         # Supabase client, auth, email helpers
  loaders/     # Astro content loaders (events, posts)
  pages/       # File-based routes
  styles/      # Global CSS
  types/       # TypeScript types
  utils/       # Shared utilities
supabase/
  schema.sql   # Database schema
```
