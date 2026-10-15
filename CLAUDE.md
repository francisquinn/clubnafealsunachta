# clubnafealsunachta

Website for Club na Fealsunachta, a philosophical discussion club based in Trieste. Astro 5, React 19, TypeScript, Supabase, deployed to Netlify.

## Quality Gates

Run all before committing:
```bash
npm test
npx astro check
```

- `npm test` runs vitest with happy-dom. Some tests may be failing — fix pre-existing failures when encountered, or note them in the commit message.
- `astro check` runs TypeScript type checking. Needs either Supabase credentials or `SKIP_CONTENT_FETCH=1` (the content loaders then return empty collections). CI uses the flag; never set it on Netlify.

## Structure

- `src/actions/` — Astro server actions
- `src/components/` — Astro and React components
- `src/layouts/` — page layouts
- `src/lib/` — Supabase client, auth, email helpers
- `src/loaders/` — Astro content loaders (events, posts)
- `src/pages/` — file-based routes
- `src/middleware.ts` — session auth, CSRF, admin gating
- `supabase/schema.sql` — database schema

## Conventions

- Issue tracking: `bd` (beads). Run from `~/Git`.
- TypeScript strict mode with `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- No commits on main. Branch or worktree only.
