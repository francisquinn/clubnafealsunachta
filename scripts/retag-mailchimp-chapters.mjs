#!/usr/bin/env node
// #178: moves Mailchimp chapter tags from club:<slug> to chapter:<slug>.
// Tags are static segments with the same name, so tagging members creates
// the chapter: segments the event emails target (see src/lib/mailchimp.ts).
//
// Usage (reads .env, the production values from `npm run sync-env`):
//   npm run retag-mailchimp
//       dry run: reads only, prints the target and the plan
//   npm run retag-mailchimp -- --apply --confirm-db=<supabase host>
//       a pure rename: tags chapter:<slug> on every contact who carries
//       club:<slug> and is still in that chapter (see lib/retagPlan.mjs)
//   npm run retag-mailchimp -- --delete-old --confirm-db=<supabase host>
//       deletes the club: static segments, removing the old tags from
//       everyone; refuses while anyone carried over lacks their chapter: tag
//
// Only adds tags to existing contacts: never creates or subscribes anyone,
// and never widens who gets a chapter's emails. Order: run --apply right
// after the migration is pushed and before the merge, so the chapter:
// segments exist before the code that targets them (the old code only reads
// club:, and can't save memberships once the tables are renamed). Then,
// with the new code live, check Mailchimp for automations, forms or saved
// segments that use club: tags, run a fresh dry run, and --delete-old.

import 'dotenv/config';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { planRetag, OLD_TAG_PREFIX, NEW_TAG_PREFIX } from './lib/retagPlan.mjs';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => !a.startsWith('--confirm-db=')));
const confirmDb = argv.find((a) => a.startsWith('--confirm-db='))?.slice('--confirm-db='.length);
const unknown = [...flags].filter((f) => f !== '--apply' && f !== '--delete-old');
if (unknown.length) {
  console.error(`Unknown option(s): ${unknown.join(', ')}`);
  process.exit(1);
}
const APPLY = flags.has('--apply');
const DELETE_OLD = flags.has('--delete-old');
if (APPLY && DELETE_OLD) {
  console.error('Run --apply first, check the result, then --delete-old on its own.');
  process.exit(1);
}

const { SUPABASE_PROJECT_URL, SUPABASE_SECRET_KEY, MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID } = process.env;
const missing = Object.entries({ SUPABASE_PROJECT_URL, SUPABASE_SECRET_KEY, MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID })
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}

// The database decides who gets tagged and whether the old tags can go, so
// a write against the real audience must name the database it reads from.
const dbHost = new URL(SUPABASE_PROJECT_URL).host;
const dbHostname = new URL(SUPABASE_PROJECT_URL).hostname;
if ((APPLY || DELETE_OLD) && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbHostname)) {
  console.error(`Refusing to write to the real Mailchimp audience from a local database (${dbHost}).`);
  process.exit(1);
}
if ((APPLY || DELETE_OLD) && confirmDb !== dbHost) {
  console.error('Writes need --confirm-db set to the host on the "Database:" line of a dry run, to confirm which database memberships are read from.');
  process.exit(1);
}

const DC = MAILCHIMP_API_KEY.split('-')[1];
const PAGE_SIZE = 1000;

async function mailchimp(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://${DC}.api.mailchimp.com/3.0${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`any:${MAILCHIMP_API_KEY}`).toString('base64')}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const json = await res.json();
      detail = json.detail ?? json.title ?? detail;
    } catch {}
    throw new Error(`${method} ${path}: ${detail}`);
  }
  return res.status === 204 ? null : res.json();
}

async function fetchAll(path, key) {
  const items = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const sep = path.includes('?') ? '&' : '?';
    const page = (await mailchimp(`${path}${sep}count=${PAGE_SIZE}&offset=${offset}`))[key] ?? [];
    items.push(...page);
    if (page.length < PAGE_SIZE) return items;
  }
}

const subscriberHash = (email) => createHash('md5').update(email.trim().toLowerCase()).digest('hex');

// Paged: the Supabase API returns at most 1000 rows per request (less if
// the project's max_rows is lower), and a short list here would let
// --delete-old pass too early, so the total is checked against an exact count.
async function loadMemberships() {
  const supabase = createClient(SUPABASE_PROJECT_URL, SUPABASE_SECRET_KEY);
  const rows = [];
  let total = null;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error, count } = await supabase
      .from('chapter_members')
      .select('member_id, chapter_id, members(email), chapters(slug)', { count: 'exact' })
      .order('member_id')
      .order('chapter_id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`chapter_members lookup failed: ${error.message}`);
    total ??= count;
    rows.push(...data);
    if (data.length === 0 || rows.length >= total) break;
  }
  if (rows.length !== total) {
    throw new Error(`chapter_members read ${rows.length} of ${total} rows; refusing to plan on a partial list.`);
  }
  const usable = rows.filter((row) => row.members?.email && row.chapters?.slug);
  if (usable.length !== rows.length) {
    console.warn(`Skipping ${rows.length - usable.length} chapter_members row(s) with no member email or chapter slug.`);
  }
  return usable.map((row) => ({ email: row.members.email, slug: row.chapters.slug }));
}

// Segment member lists leave out unsubscribed, cleaned and transactional
// contacts by default; include them so the plan (and what --delete-old
// removes) covers everyone carrying the tag. One segment at a time: the API
// key (shared with the live site) allows 10 simultaneous connections.
async function loadTagSegments() {
  const all = await fetchAll(`/lists/${MAILCHIMP_AUDIENCE_ID}/segments?type=static`, 'segments');
  const segments = [];
  for (const s of all.filter((s) => s.name.startsWith(OLD_TAG_PREFIX) || s.name.startsWith(NEW_TAG_PREFIX))) {
    const members = await fetchAll(
      `/lists/${MAILCHIMP_AUDIENCE_ID}/segments/${s.id}/members?include_unsubscribed=true&include_cleaned=true&include_transactional=true&fields=members.email_address`,
      'members'
    );
    segments.push({ id: s.id, name: s.name, emails: members.map((m) => m.email_address) });
  }
  return segments;
}

// Pending and archived contacts don't appear in segment listings, so read
// their tags directly (see planRetag's `hidden`).
async function loadHiddenContacts() {
  const contacts = [];
  for (const status of ['pending', 'archived']) {
    const members = await fetchAll(
      `/lists/${MAILCHIMP_AUDIENCE_ID}/members?status=${status}&fields=members.email_address,members.tags`,
      'members'
    );
    for (const m of members) contacts.push({ email: m.email_address, status, tags: (m.tags ?? []).map((t) => t.name) });
  }
  return contacts;
}

// Tag only: everyone tagged already carries club:<slug>, so is an existing
// contact whose subscription status is never touched.
async function tagMember(email, tag) {
  await mailchimp(`/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash(email)}/tags`, {
    method: 'POST',
    body: { tags: [{ name: tag, status: 'active' }] },
  });
}

const audience = await mailchimp(`/lists/${MAILCHIMP_AUDIENCE_ID}?fields=name,stats.member_count`);
console.log(`Database: ${dbHost}`);
console.log(`Audience: ${audience.name} (${MAILCHIMP_AUDIENCE_ID}), ${audience.stats.member_count} subscribed`);

const memberships = await loadMemberships();
const segments = await loadTagSegments();
const hidden = await loadHiddenContacts();
const plan = planRetag({ memberships, segments, hidden });

console.log(`Memberships in chapter_members: ${memberships.length}`);
console.log(`Already tagged chapter:: ${plan.alreadyTagged}`);
console.log(`To tag chapter:: ${plan.toTag.length}`);
for (const { email, tag } of plan.toTag) console.log(`  + ${email}  ${tag}`);
if (plan.notCarriedOver.length) {
  console.log(`Memberships without the old tag, left alone (they can opt in by saving their chapters): ${plan.notCarriedOver.length}`);
  for (const { email, tag } of plan.notCarriedOver) console.log(`  - ${email}  ${tag}`);
}
if (plan.archivedSkipped.length) {
  console.log(`Archived contacts with the old tag, left alone: ${plan.archivedSkipped.length}`);
  for (const { email, tag } of plan.archivedSkipped) console.log(`  ~ ${email}  ${tag}`);
}
console.log(`Old club: segments: ${plan.oldSegments.map((s) => `${s.name} (${s.memberCount})`).join(', ') || 'none'}`);
if (plan.oldOnly.length) {
  console.log(`Old tags with no matching membership (not carried over): ${plan.oldOnly.length}`);
  for (const { email, tag } of plan.oldOnly) console.log(`  ? ${email}  ${tag}`);
}

if (APPLY) {
  const failures = [];
  for (const { email, tag } of plan.toTag) {
    try {
      await tagMember(email, tag);
      console.log(`  tagged ${email}  ${tag}`);
    } catch (e) {
      failures.push(email);
      console.error(`  FAILED ${email}  ${tag}: ${e.message}`);
    }
  }
  console.log(`Tagged ${plan.toTag.length - failures.length}/${plan.toTag.length}.`);
  if (failures.length) process.exit(1);
} else if (DELETE_OLD) {
  if (!plan.canDeleteOld) {
    console.error(`Refusing to delete: ${plan.toTag.length} carried-over contact(s) still lack their chapter: tag. Run --apply first.`);
    process.exit(1);
  }
  for (const segment of plan.oldSegments) {
    await mailchimp(`/lists/${MAILCHIMP_AUDIENCE_ID}/segments/${segment.id}`, { method: 'DELETE' });
    console.log(`  deleted ${segment.name} (${segment.memberCount} contacts untagged)`);
  }
} else {
  console.log('Dry run: nothing changed. Use --apply, then --delete-old (both need --confirm-db).');
}
