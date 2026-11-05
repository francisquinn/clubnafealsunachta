import { supabaseAdmin } from './supabase';
import { unwrapRelation } from './supabaseRelations';

export type MemberChapter = { id: number; name: string; emailsEnabled: boolean };

// The chapters a member is in and whether each one's event emails are on
// (#211), sorted by name, for the profile settings form. Returns null when
// the lookup fails: that must not read as "in no chapter", so the profile
// hides its chapter sections instead.
export async function loadMemberChapters(memberId: string): Promise<MemberChapter[] | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('chapter_members')
    .select('chapter_id, emails_enabled, chapters(name)')
    .eq('member_id', memberId);
  if (error) {
    console.error('Failed to load chapter memberships for profile edit:', error.message);
    return null;
  }

  return (data ?? [])
    .map((membership) => ({
      id: membership.chapter_id as number,
      name: unwrapRelation<{ name: string }>(membership.chapters)?.name ?? '',
      emailsEnabled: membership.emails_enabled === true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
