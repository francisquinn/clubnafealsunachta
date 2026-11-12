import { supabaseAdmin } from './supabase';
import { escapeLikePattern } from './username';

export type ProfileMember = {
  id: string;
  username: string;
  full_name: string | null;
  display_full_name: boolean;
  avatar_url: string | null;
  created_at: string;
};

// The member behind /profile/<username> (#223). Matches the username
// case-insensitively, like signup's uniqueness check and login, so
// /profile/Alice finds alice; the page then redirects to the stored spelling.
// Returns null when there's no such member or the lookup fails.
export async function findMemberByUsername(username: string): Promise<ProfileMember | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('members')
    .select('id, username, full_name, display_full_name, avatar_url, created_at')
    .ilike('username', escapeLikePattern(username))
    .maybeSingle();
  if (error) {
    console.error('Failed to load member for profile page:', error.message);
    return null;
  }
  return data as ProfileMember | null;
}

// #221: how many events this member said they were going to and which have
// since ended, shown publicly on their profile. An RSVP is intent, not a
// check-in, so this is "said they'd go", not proven attendance. `!inner` makes
// the end_date filter drop RSVPs to events that haven't ended, rather than
// keeping them with a null embed. Returns 0 when the lookup fails.
export async function countPastGoingRsvps(memberId: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { count, error } = await supabaseAdmin
    .from('rsvps')
    .select('event_id, events!inner(end_date)', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('status', 'going')
    .lt('events.end_date', new Date().toISOString());
  if (error) {
    console.error('Failed to load past events for profile page:', error.message);
    return 0;
  }
  return count ?? 0;
}
