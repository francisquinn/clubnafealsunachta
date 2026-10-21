// #178: pure planning for the club:<slug> → chapter:<slug> Mailchimp re-tag,
// kept free of I/O so it can be unit-tested.
//
// A pure rename: a contact gets chapter:<slug> only if they already carry
// club:<slug> and are still in that chapter in chapter_members. Neither side
// alone is enough:
// - an old club: tag can be stale (a member who left the chapter keeps it),
//   so it's reported, never copied;
// - a chapter_members row without the old tag is usually the #64-era Trieste
//   backfill, which nobody chose and which was never tagged, so tagging it
//   would start sending event emails to people who never asked for them. It's
//   reported and left alone; the member can opt in by saving their chapters.

export const OLD_TAG_PREFIX = 'club:';
export const NEW_TAG_PREFIX = 'chapter:';

const normalize = (email) => email.trim().toLowerCase();

// memberships: [{ email, slug }] from chapter_members.
// segments: [{ id, name, emails: string[] }] for every club: and chapter:
// static segment on the audience (a Mailchimp tag is a static segment with
// the same name).
// hidden: [{ email, status, tags: string[] }] for pending and archived
// contacts, which segment listings leave out. Pending ones (an unconfirmed
// newsletter signup who later saved their chapters) count like everyone
// else, so a confirmation later doesn't find their chapter choice gone.
// Archived ones were archived on purpose and are reported, never tagged.
export function planRetag({ memberships, segments, hidden = [] }) {
  const byName = new Map(segments.map((s) => [s.name, new Set(s.emails.map(normalize))]));
  const archived = new Map();
  for (const contact of hidden) {
    if (contact.status === 'archived') {
      archived.set(normalize(contact.email), new Set(contact.tags));
      continue;
    }
    for (const tag of contact.tags) {
      if (!tag.startsWith(OLD_TAG_PREFIX) && !tag.startsWith(NEW_TAG_PREFIX)) continue;
      if (!byName.has(tag)) byName.set(tag, new Set());
      byName.get(tag).add(normalize(contact.email));
    }
  }
  const wanted = new Set();

  const toTag = [];
  const notCarriedOver = [];
  const archivedSkipped = [];
  let alreadyTagged = 0;
  for (const { email, slug } of memberships) {
    const tag = `${NEW_TAG_PREFIX}${slug}`;
    const key = `${normalize(email)} ${slug}`;
    if (wanted.has(key)) continue;
    wanted.add(key);
    if (archived.has(normalize(email))) {
      const tags = archived.get(normalize(email));
      if (tags.has(tag)) alreadyTagged += 1;
      else if (tags.has(`${OLD_TAG_PREFIX}${slug}`)) archivedSkipped.push({ email, tag });
      else notCarriedOver.push({ email, tag });
    } else if (byName.get(tag)?.has(normalize(email))) {
      alreadyTagged += 1;
    } else if (byName.get(`${OLD_TAG_PREFIX}${slug}`)?.has(normalize(email))) {
      toTag.push({ email, tag });
    } else {
      notCarriedOver.push({ email, tag });
    }
  }

  // Old tags with no matching membership: reported so they can be checked
  // before the old segments are deleted, not carried over. Built from the
  // merged sets, so pending contacts are counted too.
  const oldOnly = [];
  const oldSegments = segments.filter((s) => s.name.startsWith(OLD_TAG_PREFIX));
  for (const segment of oldSegments) {
    const slug = segment.name.slice(OLD_TAG_PREFIX.length);
    for (const email of byName.get(segment.name)) {
      if (!wanted.has(`${email} ${slug}`)) oldOnly.push({ email, tag: segment.name });
    }
  }

  return {
    toTag,
    alreadyTagged,
    notCarriedOver,
    archivedSkipped,
    oldOnly,
    oldSegments: oldSegments.map((s) => ({ id: s.id, name: s.name, memberCount: byName.get(s.name).size })),
    // Only safe to delete the old segments once everyone carried over has
    // their chapter: tag, or a chapter's event emails would lose part of
    // their audience.
    canDeleteOld: toTag.length === 0,
  };
}
