import { describe, it, expect } from 'vitest';
import { suggestTopicGate } from './suggestTopicGate';

const MEMBER = { username: 'aoife', full_name: 'Aoife Byrne', display_full_name: false };
const CHAPTERS = [
  { id: 2, name: 'Online', emailsEnabled: true },
  { id: 1, name: 'Trieste', emailsEnabled: false },
];

describe('suggestTopicGate', () => {
  it('sends a signed-out visitor to the login placeholder', () => {
    expect(suggestTopicGate(false, null, null)).toEqual({ kind: 'signedOut' });
  });

  it('reports a failed lookup rather than "no chapters"', () => {
    expect(suggestTopicGate(true, MEMBER, null)).toEqual({ kind: 'loadFailed' });
    expect(suggestTopicGate(true, null, CHAPTERS)).toEqual({ kind: 'loadFailed' });
  });

  it('nudges a member in no chapter to join one', () => {
    expect(suggestTopicGate(true, MEMBER, [])).toEqual({ kind: 'noChapters' });
  });

  it('shows the form with only their chapters and the name they show publicly', () => {
    expect(suggestTopicGate(true, MEMBER, CHAPTERS)).toEqual({
      kind: 'form',
      displayName: 'aoife',
      chapters: [
        { id: 2, name: 'Online' },
        { id: 1, name: 'Trieste' },
      ],
    });
    expect(suggestTopicGate(true, { ...MEMBER, display_full_name: true }, CHAPTERS)).toMatchObject({
      displayName: 'Aoife Byrne',
    });
  });
});
