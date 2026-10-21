import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { verifySession } from '../lib/auth';
import { supabaseAdmin } from '../lib/supabase';
import { addChapterTag, removeChapterTag } from '../lib/mailchimp';

// #55: mirror the member's chapter subscriptions onto Mailchimp member tags
// (chapter:<slug>) so event emails can target one chapter's audience. Everything
// checked stays tagged on, everything not checked (against the full chapter
// list) is tagged off — an idempotent upsert, so saving the same choice
// again is a no-op, and a member with no stored email just skips out.
async function syncMailchimpChapterTags(memberId: string, selectedChapterIds: number[]): Promise<void> {
  if (!supabaseAdmin) return;

  const { data: member, error: memberError } = await supabaseAdmin
    .from('members')
    .select('email')
    .eq('id', memberId)
    .single();
  if (memberError || !member?.email) return;

  const { data: chapters, error: chaptersError } = await supabaseAdmin
    .from('chapters')
    .select('id, slug');
  if (chaptersError) return;

  const slugById = new Map((chapters ?? []).map((chapter) => [chapter.id, chapter.slug]));
  const leavingChapterIds = (chapters ?? []).map((chapter) => chapter.id).filter((id) => !selectedChapterIds.includes(id));

  for (const id of selectedChapterIds) {
    const slug = slugById.get(id);
    if (slug) await addChapterTag(member.email, slug);
  }
  for (const id of leavingChapterIds) {
    const slug = slugById.get(id);
    if (slug) await removeChapterTag(member.email, slug);
  }
}

// #38: any logged-in member can register to any chapter — this is purely an
// opt-in to that chapter's news/updates, not a gate on browsing/RSVP (which
// stay open regardless), so there's no admin-scope check here at all.
export const updateChapterMemberships = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const token = context.cookies.get('session')?.value;
    const payload = await verifySession(token);
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    // Number("") is 0, not NaN, so a blank/malformed value would otherwise
    // slip past Number.isInteger — filter those out explicitly (chapter ids are
    // sequence-backed starting at 1, see chapters_id_seq).
    const selectedChapterIds = [...new Set(
      formData.getAll('chapter_id')
        .map((value) => Number(value))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    // Validate against real chapters up front so a stale/tampered id fails with
    // a clear 400 here instead of an opaque FK-violation 500 down at insert.
    if (selectedChapterIds.length > 0) {
      const { data: validChapters, error: chaptersError } = await supabaseAdmin
        .from('chapters')
        .select('id')
        .in('id', selectedChapterIds);

      if (chaptersError) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update chapter subscriptions' });
      }
      if ((validChapters ?? []).length !== selectedChapterIds.length) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'One or more selected chapters do not exist' });
      }
    }

    // Replace the member's full membership set with an insert first, then a
    // delete of whatever's left over — not the other way around. If the
    // insert fails partway, the member still has their prior memberships
    // intact; a delete-first ordering would instead leave them with nothing
    // if the following insert failed. `ignoreDuplicates` makes the insert
    // tolerant of a same-request repeat (e.g. a racing double-submit)
    // instead of surfacing a raw unique-violation error.
    if (selectedChapterIds.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('chapter_members')
        .upsert(
          selectedChapterIds.map((chapter_id) => ({ member_id: payload.memberId, chapter_id })),
          { onConflict: 'member_id,chapter_id', ignoreDuplicates: true }
        );
      if (insertError) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update chapter subscriptions' });
      }
    }

    let deleteQuery = supabaseAdmin.from('chapter_members').delete().eq('member_id', payload.memberId);
    if (selectedChapterIds.length > 0) {
      deleteQuery = deleteQuery.not('chapter_id', 'in', `(${selectedChapterIds.join(',')})`);
    }
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update chapter subscriptions' });
    }

    // #55: keep the Mailchimp tags in line with the new membership set.
    // Best effort never fails the request — same posture as the event email
    // in createEvent — so a transient Mailchimp outage can't strand the
    // member with a half-applied chapter change.
    try {
      await syncMailchimpChapterTags(payload.memberId, selectedChapterIds);
    } catch (err) {
      console.error('Mailchimp chapter tag sync failed:', err);
    }

    return { success: true, chapter_ids: selectedChapterIds };
  },
});

// The chapter page's "Join the chapter" button: add the member to one chapter,
// leaving their other memberships alone (updateChapterMemberships replaces the
// whole set, so it can't be used for a single join). Same side effects as
// ticking the chapter in account settings, including the Mailchimp tag.
export const joinChapter = defineAction({
  input: z.object({ chapterId: z.number().int().positive() }),
  handler: async ({ chapterId }, context) => {
    const payload = await verifySession(context.cookies.get('session')?.value);
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from('chapters')
      .select('id, slug')
      .eq('id', chapterId)
      .maybeSingle();
    if (chapterError) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to join chapter' });
    }
    if (!chapter) {
      throw new ActionError({ code: 'NOT_FOUND', message: 'Chapter not found' });
    }

    // ignoreDuplicates makes a repeat join (double click, second tab) a no-op.
    const { error: insertError } = await supabaseAdmin
      .from('chapter_members')
      .upsert(
        [{ member_id: payload.memberId, chapter_id: chapter.id }],
        { onConflict: 'member_id,chapter_id', ignoreDuplicates: true }
      );
    if (insertError) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to join chapter' });
    }

    // Best effort, like updateChapterMemberships: a Mailchimp hiccup must not
    // undo a join that already succeeded.
    try {
      const { data: member } = await supabaseAdmin
        .from('members')
        .select('email')
        .eq('id', payload.memberId)
        .single();
      if (member?.email) await addChapterTag(member.email, chapter.slug);
    } catch (err) {
      console.error('Mailchimp chapter tag sync failed:', err);
    }

    return { joined: true };
  },
});

// Whether the logged-in member is already in a chapter, so the button can show
// "you're in" instead of offering to join again.
export const getChapterMembership = defineAction({
  input: z.object({ chapterId: z.number().int().positive() }),
  handler: async ({ chapterId }, context) => {
    const payload = await verifySession(context.cookies.get('session')?.value);
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const { data, error } = await supabaseAdmin
      .from('chapter_members')
      .select('chapter_id')
      .eq('member_id', payload.memberId)
      .eq('chapter_id', chapterId)
      .maybeSingle();
    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to load membership' });
    }

    return { joined: data !== null };
  },
});
