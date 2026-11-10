export interface DisplayableMember {
  username: string;
  full_name: string | null;
  display_full_name: boolean;
}

// #210: shown in place of the author of a post or event whose member has
// deleted their account (author_id/created_by cleared to null).
export const FORMER_MEMBER = "Former member";

export function getDisplayName(member: DisplayableMember): string {
  if (member.display_full_name && member.full_name) {
    return member.full_name;
  }
  return member.username;
}
