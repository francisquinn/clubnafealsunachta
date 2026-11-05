import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { verifySession } from '../lib/auth';
import { supabaseAdmin } from '../lib/supabase';
// Profile settings' chapter list (#211): members can only leave a chapter or
// switch its event emails here, never join one — joining is the chapter
// page's button. `chapter_shown` lists the chapters the form showed,
// `chapter_id` the shown ones still ticked, `chapter_emails` those with
// event emails ticked and `chapter_emails_was` those whose emails were on
// when the form loaded. Only shown chapters are touched, and a chapter's
// emails are only written when its box changed, so saving a stale form
// can't undo a join, an opt-in or an opt-out made in another tab. Every
// write is an update or delete of the member's own rows, so nothing here
// can join.
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
    const chapterIdsFrom = (field: string) => [...new Set(
      formData.getAll(field)
        .map((value) => Number(value))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];
    const shownChapterIds = chapterIdsFrom('chapter_shown');
    const tickedChapterIds = chapterIdsFrom('chapter_id');
    const emailChapterIds = chapterIdsFrom('chapter_emails');
    const emailsWereOnIds = chapterIdsFrom('chapter_emails_was');

    const keptChapterIds = shownChapterIds.filter((id) => tickedChapterIds.includes(id));
    const leftChapterIds = shownChapterIds.filter((id) => !tickedChapterIds.includes(id));
    const emailsOnIds = keptChapterIds.filter((id) => emailChapterIds.includes(id) && !emailsWereOnIds.includes(id));
    const emailsOffIds = keptChapterIds.filter((id) => !emailChapterIds.includes(id) && emailsWereOnIds.includes(id));

    const writes = [
      leftChapterIds.length > 0 &&
        supabaseAdmin.from('chapter_members').delete().eq('member_id', payload.memberId).in('chapter_id', leftChapterIds),
      emailsOnIds.length > 0 &&
        supabaseAdmin.from('chapter_members').update({ emails_enabled: true }).eq('member_id', payload.memberId).in('chapter_id', emailsOnIds),
      emailsOffIds.length > 0 &&
        supabaseAdmin.from('chapter_members').update({ emails_enabled: false }).eq('member_id', payload.memberId).in('chapter_id', emailsOffIds),
    ].filter((write) => write !== false);

    const results = await Promise.all(writes);
    if (results.some((result) => result.error)) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update chapter settings' });
    }

    return { success: true, chapter_ids: keptChapterIds };
  },
});

// The chapter page's "Join the chapter" button: add the member to one chapter,
// leaving their other memberships alone. It's the only way into a chapter
// (#211), and joins with event emails off: the welcome modal's checkbox
// (setChapterEmails) is where the member opts in.
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

    return { joined: true };
  },
});

// The chapter page's "Member" button: take the member out of one chapter,
// leaving their other memberships alone. Leaving a chapter the member is not
// in is a no-op.
export const leaveChapter = defineAction({
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
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to leave chapter' });
    }
    if (!chapter) {
      throw new ActionError({ code: 'NOT_FOUND', message: 'Chapter not found' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('chapter_members')
      .delete()
      .eq('member_id', payload.memberId)
      .eq('chapter_id', chapter.id);
    if (deleteError) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to leave chapter' });
    }

    return { joined: false };
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

// The welcome modal's "Email me about upcoming events" checkbox (#211): turn a
// chapter's event emails on or off for the logged-in member. Only for a
// chapter they're in, so it can't be used to join one.
export const setChapterEmails = defineAction({
  input: z.object({ chapterId: z.number().int().positive(), enabled: z.boolean() }),
  handler: async ({ chapterId, enabled }, context) => {
    const payload = await verifySession(context.cookies.get('session')?.value);
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    const { data, error } = await supabaseAdmin
      .from('chapter_members')
      .update({ emails_enabled: enabled })
      .eq('member_id', payload.memberId)
      .eq('chapter_id', chapterId)
      .select('chapter_id');
    if (error) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save email preference' });
    }
    if (!data || data.length === 0) {
      throw new ActionError({ code: 'NOT_FOUND', message: 'Not a member of this chapter' });
    }

    return { emailsEnabled: enabled };
  },
});
