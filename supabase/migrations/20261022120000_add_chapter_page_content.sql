-- Issue #132: a chapter's own page and the chapters index show per-chapter
-- copy (description, photo, regular meet-up, chat group, what to expect,
-- social links). It lived in src/lib/chapterContent.ts; it moves onto the
-- chapters row so it can be edited without a deploy. The copy columns are
-- nullable: a chapter without its own copy falls back to generic copy in
-- code, and one without a meet-up or chat group simply doesn't show them.
-- The regular meet-up's place is a row in venues, the same table events use,
-- so a venue's name and link are kept in one place.
--
-- Also adds the chapter's timezone (the zone its events' wall-clock times are
-- in), defaulting to Europe/Rome, the only zone in use today. Nothing reads
-- it yet: events still use DEFAULT_CHAPTER_TIMEZONE until that is wired up.
--
-- Additive only, so the old code keeps working until the new code is live.

alter table public.chapters
  add column description text,
  add column photo text,
  add column meeting_when text,
  add column meeting_venue_id integer references public.venues (id),
  add column chat_url text,
  add column what_to_expect text[],
  add column social jsonb,
  add column timezone text not null default 'Europe/Rome';

-- A meet-up needs both a time and a place, or it isn't shown at all.
alter table public.chapters
  add constraint chapters_meeting_complete_check
  check ((meeting_when is null) = (meeting_venue_id is null));

insert into public.venues (name, url, chapter_id)
select 'Polo Toti', 'https://maps.app.goo.gl/DmRP9s2jtz7Ju8sq5', id
from public.chapters
where slug = 'trieste'
on conflict (name, chapter_id) do nothing;

update public.chapters
set description = 'Our home chapter, where it all began.',
    photo = '/values/curiosity.jpg',
    meeting_when = 'Thursdays @ 18:30',
    meeting_venue_id = (
      select v.id from public.venues v
      where v.name = 'Polo Toti' and v.chapter_id = chapters.id
    ),
    chat_url = 'https://chat.whatsapp.com/DWWJHDzgH8OJzSslTIwP0u',
    what_to_expect = array[
      'You don''t need any philosophy background.',
      'It''s free of charge.',
      'No booking needed, just turn up.',
      'Sessions are held in English.',
      'We meet outside Bar Barakin @ 18:00.',
      'Each session is built around one central question or topic.',
      'If there are many of us, we split into small groups, each with its own facilitator.',
      'Some sessions use a different format, so the evening can vary.',
      'Sessions last about an hour and a half.',
      'Afterwards we head out for a bite and a pint, and keep the conversation flowing.'
    ],
    social = '[
      {"name": "Instagram", "href": "https://www.instagram.com/clubnafealsunachta/", "icon": "/instagram.svg"},
      {"name": "Facebook", "href": "https://www.facebook.com/people/Club-na-Fealsúnachta/61578150433186/", "icon": "/facebook.svg"},
      {"name": "Meetup", "href": "https://www.meetup.com/clubnafealsunachta/", "icon": "/meetup.svg"}
    ]'::jsonb
where slug = 'trieste';

update public.chapters
set description = 'Discussions you can join from anywhere. The Online chapter brings people together over video for the same open, curious conversations, wherever you are in the world.',
    photo = '/values/open-mindedness.jpg'
where slug = 'online';

notify pgrst, 'reload schema';
