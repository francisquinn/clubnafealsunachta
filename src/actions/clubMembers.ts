import { defineAction, ActionError } from 'astro:actions';
import { verifySessionToken } from '../lib/auth';
import { supabaseAdmin } from '../lib/supabase';

// #38: any logged-in member can register to any club — this is purely an
// opt-in to that club's news/updates, not a gate on browsing/RSVP (which
// stay open regardless), so there's no admin-scope check here at all.
export const updateClubMemberships = defineAction({
  accept: 'form',
  handler: async (formData, context) => {
    const token = context.cookies.get('session')?.value;
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
      throw new ActionError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    if (!supabaseAdmin) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Supabase not configured' });
    }

    // Number("") is 0, not NaN, so a blank/malformed value would otherwise
    // slip past Number.isInteger — filter those out explicitly (club ids are
    // sequence-backed starting at 1, see clubs_id_seq).
    const selectedClubIds = [...new Set(
      formData.getAll('club_id')
        .map((value) => Number(value))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    // Validate against real clubs up front so a stale/tampered id fails with
    // a clear 400 here instead of an opaque FK-violation 500 down at insert.
    if (selectedClubIds.length > 0) {
      const { data: validClubs, error: clubsError } = await supabaseAdmin
        .from('clubs')
        .select('id')
        .in('id', selectedClubIds);

      if (clubsError) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update club subscriptions' });
      }
      if ((validClubs ?? []).length !== selectedClubIds.length) {
        throw new ActionError({ code: 'BAD_REQUEST', message: 'One or more selected clubs do not exist' });
      }
    }

    // Replace the member's full membership set with an insert first, then a
    // delete of whatever's left over — not the other way around. If the
    // insert fails partway, the member still has their prior memberships
    // intact; a delete-first ordering would instead leave them with nothing
    // if the following insert failed. `ignoreDuplicates` makes the insert
    // tolerant of a same-request repeat (e.g. a racing double-submit)
    // instead of surfacing a raw unique-violation error.
    if (selectedClubIds.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('club_members')
        .upsert(
          selectedClubIds.map((club_id) => ({ member_id: payload.memberId, club_id })),
          { onConflict: 'member_id,club_id', ignoreDuplicates: true }
        );
      if (insertError) {
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update club subscriptions' });
      }
    }

    let deleteQuery = supabaseAdmin.from('club_members').delete().eq('member_id', payload.memberId);
    if (selectedClubIds.length > 0) {
      deleteQuery = deleteQuery.not('club_id', 'in', `(${selectedClubIds.join(',')})`);
    }
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update club subscriptions' });
    }

    return { success: true, club_ids: selectedClubIds };
  },
});
