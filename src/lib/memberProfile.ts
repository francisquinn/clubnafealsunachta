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
