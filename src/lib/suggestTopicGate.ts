import { getDisplayName, type DisplayableMember } from './memberDisplay';
import type { MemberChapter } from './memberChapters';

// #140: what /suggest-topic shows. Members only, for a chapter they're in.
// A failed lookup (member or chapters null for a signed-in visitor) must not
// read as "in no chapter", so it gets its own state.
export type SuggestTopicGate =
  | { kind: 'signedOut' }
  | { kind: 'loadFailed' }
  | { kind: 'noChapters' }
  | { kind: 'form'; displayName: string; chapters: { id: number; name: string }[] };

export function suggestTopicGate(
  signedIn: boolean,
  member: DisplayableMember | null,
  chapters: MemberChapter[] | null,
): SuggestTopicGate {
  if (!signedIn) return { kind: 'signedOut' };
  if (!member || !chapters) return { kind: 'loadFailed' };
  if (chapters.length === 0) return { kind: 'noChapters' };
  return {
    kind: 'form',
    displayName: getDisplayName(member),
    chapters: chapters.map(({ id, name }) => ({ id, name })),
  };
}
