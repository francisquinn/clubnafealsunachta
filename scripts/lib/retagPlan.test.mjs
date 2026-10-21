import { describe, it, expect } from 'vitest';
import { planRetag, NEW_TAG_PREFIX } from './retagPlan.mjs';
import { CHAPTER_TAG_PREFIX } from '../../src/lib/mailchimp';

const segment = (id, name, emails) => ({ id, name, emails });

describe('planRetag', () => {
  it('uses the same tag prefix as the app', () => {
    expect(NEW_TAG_PREFIX).toBe(CHAPTER_TAG_PREFIX);
  });

  it('carries over a member who has the old tag and is still in the chapter', () => {
    const plan = planRetag({
      memberships: [{ email: 'aoife@example.com', slug: 'trieste' }],
      segments: [segment(1, 'club:trieste', ['aoife@example.com'])],
    });

    expect(plan.toTag).toEqual([{ email: 'aoife@example.com', tag: 'chapter:trieste' }]);
    expect(plan.notCarriedOver).toEqual([]);
    expect(plan.canDeleteOld).toBe(false);
  });

  // The Trieste backfill put every member into chapter_members without
  // tagging them: tagging them now would widen who gets event emails.
  it('leaves a membership without the old tag alone, without blocking --delete-old', () => {
    const plan = planRetag({
      memberships: [
        { email: 'aoife@example.com', slug: 'trieste' },
        { email: 'backfilled@example.com', slug: 'trieste' },
      ],
      segments: [
        segment(1, 'club:trieste', ['aoife@example.com']),
        segment(2, 'chapter:trieste', ['aoife@example.com']),
      ],
    });

    expect(plan.toTag).toEqual([]);
    expect(plan.notCarriedOver).toEqual([{ email: 'backfilled@example.com', tag: 'chapter:trieste' }]);
    expect(plan.canDeleteOld).toBe(true);
  });

  // A member who left Trieste keeps a stale club: tag.
  it('reports an old tag with no matching membership instead of copying it', () => {
    const plan = planRetag({
      memberships: [{ email: 'aoife@example.com', slug: 'trieste' }],
      segments: [segment(1, 'club:trieste', ['aoife@example.com', 'leaver@example.com'])],
    });

    expect(plan.toTag).toEqual([{ email: 'aoife@example.com', tag: 'chapter:trieste' }]);
    expect(plan.oldOnly).toEqual([{ email: 'leaver@example.com', tag: 'club:trieste' }]);
  });

  it('only carries over the old tag for the same chapter', () => {
    const plan = planRetag({
      memberships: [{ email: 'aoife@example.com', slug: 'online' }],
      segments: [segment(1, 'club:trieste', ['aoife@example.com'])],
    });

    expect(plan.toTag).toEqual([]);
    expect(plan.notCarriedOver).toEqual([{ email: 'aoife@example.com', tag: 'chapter:online' }]);
    expect(plan.oldOnly).toEqual([{ email: 'aoife@example.com', tag: 'club:trieste' }]);
  });

  it('matches emails ignoring case across the database and both tags', () => {
    const plan = planRetag({
      memberships: [
        { email: 'Aoife@Example.com', slug: 'trieste' },
        { email: 'niamh@example.com', slug: 'trieste' },
      ],
      segments: [
        segment(1, 'club:trieste', ['aoife@example.com', 'Niamh@Example.com']),
        segment(2, 'chapter:trieste', ['AOIFE@example.com']),
      ],
    });

    expect(plan.alreadyTagged).toBe(1);
    expect(plan.toTag).toEqual([{ email: 'niamh@example.com', tag: 'chapter:trieste' }]);
    expect(plan.oldOnly).toEqual([]);
  });

  it('only allows deleting the old segments once everyone carried over is tagged', () => {
    const memberships = [
      { email: 'aoife@example.com', slug: 'trieste' },
      { email: 'niamh@example.com', slug: 'trieste' },
    ];
    const oldSegment = segment(1, 'club:trieste', ['aoife@example.com', 'niamh@example.com']);

    const halfway = planRetag({ memberships, segments: [oldSegment, segment(2, 'chapter:trieste', ['aoife@example.com'])] });
    expect(halfway.canDeleteOld).toBe(false);

    const done = planRetag({ memberships, segments: [oldSegment, segment(2, 'chapter:trieste', ['aoife@example.com', 'niamh@example.com'])] });
    expect(done.canDeleteOld).toBe(true);
    expect(done.oldSegments).toEqual([{ id: 1, name: 'club:trieste', memberCount: 2 }]);
    expect(done.oldOnly).toEqual([]);
  });

  // Segment listings leave out pending contacts: a pending member who saved
  // their chapters still carries club:, read from their own tags instead.
  it('carries over a pending contact using their own tags, and sees their new tag', () => {
    const memberships = [{ email: 'pending@example.com', slug: 'trieste' }];

    const before = planRetag({ memberships, segments: [], hidden: [{ email: 'Pending@Example.com', status: 'pending', tags: ['club:trieste'] }] });
    expect(before.toTag).toEqual([{ email: 'pending@example.com', tag: 'chapter:trieste' }]);
    expect(before.notCarriedOver).toEqual([]);

    const after = planRetag({ memberships, segments: [], hidden: [{ email: 'pending@example.com', status: 'pending', tags: ['club:trieste', 'chapter:trieste'] }] });
    expect(after.alreadyTagged).toBe(1);
    expect(after.canDeleteOld).toBe(true);
  });

  it('includes pending contacts in the old-tag report and counts', () => {
    const plan = planRetag({
      memberships: [],
      segments: [segment(1, 'club:trieste', ['aoife@example.com'])],
      hidden: [{ email: 'pending@example.com', status: 'pending', tags: ['club:trieste'] }],
    });

    expect(plan.oldSegments).toEqual([{ id: 1, name: 'club:trieste', memberCount: 2 }]);
    expect(plan.oldOnly.map((o) => o.email).sort()).toEqual(['aoife@example.com', 'pending@example.com']);
  });

  it('counts an archived contact who already has the new tag as tagged', () => {
    const plan = planRetag({
      memberships: [{ email: 'archived@example.com', slug: 'trieste' }],
      segments: [],
      hidden: [{ email: 'archived@example.com', status: 'archived', tags: ['club:trieste', 'chapter:trieste'] }],
    });

    expect(plan.alreadyTagged).toBe(1);
    expect(plan.archivedSkipped).toEqual([]);
  });

  it('reports an archived contact with the old tag instead of tagging them, without blocking --delete-old', () => {
    const plan = planRetag({
      memberships: [{ email: 'archived@example.com', slug: 'trieste' }],
      segments: [],
      hidden: [{ email: 'Archived@Example.com', status: 'archived', tags: ['club:trieste'] }],
    });

    expect(plan.toTag).toEqual([]);
    expect(plan.archivedSkipped).toEqual([{ email: 'archived@example.com', tag: 'chapter:trieste' }]);
    expect(plan.notCarriedOver).toEqual([]);
    expect(plan.canDeleteOld).toBe(true);
  });

  it('tags a member once per chapter even if a membership row repeats', () => {
    const plan = planRetag({
      memberships: [
        { email: 'aoife@example.com', slug: 'trieste' },
        { email: 'aoife@example.com', slug: 'trieste' },
      ],
      segments: [segment(1, 'club:trieste', ['aoife@example.com'])],
    });

    expect(plan.toTag).toEqual([{ email: 'aoife@example.com', tag: 'chapter:trieste' }]);
  });
});
