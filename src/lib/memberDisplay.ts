export interface DisplayableMember {
  username: string;
  full_name: string | null;
  display_full_name: boolean;
}

export function getDisplayName(member: DisplayableMember): string {
  if (member.display_full_name && member.full_name) {
    return member.full_name;
  }
  return member.username;
}
