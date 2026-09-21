-- Local dev seed data: a couple of members, a venue, some events and posts,
-- so `npm run dev:local` has something to actually browse instead of empty
-- collections. Only ever applied locally, by `supabase db reset`/`supabase
-- start` (see supabase/config.toml's [db.seed] section) — never runs
-- against production.
--
-- Both seed members log in locally with the password "localdev123".

insert into public.members (id, email, password_hash, username, full_name, is_admin, email_verified_at)
values
  ('00000000-0000-0000-0000-000000000001', 'aoife@example.com',
   '30ae246a5ad46ed4890311078edd35e6:e33d2428a65c8294241e90684e667b5f0ec3cdd9293523a797e240eca900db08af71db39a376375e8c448974ef0a1019c7831324ff0457546a4331faf7bbf656',
   'aoife', 'Aoife Byrne', true, now()),
  ('00000000-0000-0000-0000-000000000002', 'marco@example.com',
   '30ae246a5ad46ed4890311078edd35e6:e33d2428a65c8294241e90684e667b5f0ec3cdd9293523a797e240eca900db08af71db39a376375e8c448974ef0a1019c7831324ff0457546a4331faf7bbf656',
   'marco', 'Marco Bianchi', false, now());

insert into public.venues (name, url, club_id)
values ('Caffè San Marco', 'https://caffesanmarco.it', (select id from public.clubs where slug = 'trieste'));

insert into public.events (name, date, end_date, slug, description, summary, venue_id, created_by, is_online, club_id)
values
  ('What is a good life?',
   now() - interval '14 days', now() - interval '14 days' + interval '2 hours',
   'what-is-a-good-life',
   'A discussion on Aristotle''s conception of eudaimonia, and whether it still holds up today.',
   'Aristotle on the good life.',
   (select id from public.venues where name = 'Caffè San Marco'),
   '00000000-0000-0000-0000-000000000001', false,
   (select id from public.clubs where slug = 'trieste')),
  ('Free will and determinism',
   now() + interval '7 days', now() + interval '7 days' + interval '2 hours',
   'free-will-and-determinism',
   'Do we really choose, or does it only feel that way?',
   'An evening on free will.',
   null,
   '00000000-0000-0000-0000-000000000002', true,
   (select id from public.clubs where slug = 'trieste')),
  ('The ethics of technology',
   now() + interval '21 days', now() + interval '21 days' + interval '2 hours',
   'the-ethics-of-technology',
   'From AI to social media, how should we think about the tools we build?',
   'Technology and ethics.',
   (select id from public.venues where name = 'Caffè San Marco'),
   '00000000-0000-0000-0000-000000000001', false,
   (select id from public.clubs where slug = 'trieste'));

insert into public.posts (title, slug, date, body, author_id)
values
  ('Notes from our first year', 'notes-from-our-first-year',
   now() - interval '30 days',
   'A short reflection on a year of Tuesday-evening conversations in Trieste.',
   '00000000-0000-0000-0000-000000000001'),
  ('Why philosophy needs a pub, not just a lecture hall', 'why-philosophy-needs-a-pub',
   now() - interval '10 days',
   'Some thoughts on why the best philosophical conversations happen over coffee, not in seminar rooms.',
   '00000000-0000-0000-0000-000000000002');
