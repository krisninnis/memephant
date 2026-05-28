import {
  cleanPublicList,
  cleanPublicText,
  filterPublicChangelog,
  isNoisyChangelogSummary,
  isPlaceholderText,
} from '../utils/contextQuality';

describe('contextQuality', () => {
  it('detects instructional placeholders used in project scaffolding', () => {
    expect(isPlaceholderText(
      'Write 1-2 sentences describing what is true right now after this session.',
    )).toBe(true);
    expect(isPlaceholderText('Explain cross-AI continuity clearly.')).toBe(false);
  });

  it('filters placeholder list items while preserving real project context', () => {
    expect(cleanPublicList([
      'List only things actively being worked on right now not done not future',
      'Added Export History compare view',
      'Added Export History compare view',
    ])).toEqual(['Added Export History compare view']);
  });

  it('falls back when a scalar value is placeholder scaffolding', () => {
    expect(cleanPublicText(
      'What is the top priority for this project?',
      'Help users move context between AI tools.',
    )).toBe('Help users move context between AI tools.');
  });

  it('suppresses repetitive low-signal changelog entries', () => {
    expect(isNoisyChangelogSummary('Copied project context for Claude.')).toBe(true);

    const changes = filterPublicChangelog([
      {
        timestamp: '2026-05-28T09:00:00.000Z',
        field: 'export',
        action: 'updated',
        summary: 'Copied project context for Claude.',
      },
      {
        timestamp: '2026-05-28T10:00:00.000Z',
        field: 'launch',
        action: 'updated',
        summary: 'Added Launch Passport polish.',
      },
      {
        timestamp: '2026-05-28T11:00:00.000Z',
        field: 'launch',
        action: 'updated',
        summary: 'Added Launch Passport polish.',
      },
      {
        timestamp: '2026-05-28T12:00:00.000Z',
        field: 'workflow',
        action: 'updated',
        summary: 'Refined workflow mode guidance.',
      },
    ]);

    expect(changes).toHaveLength(2);
    expect(changes).toEqual(expect.arrayContaining([
      'Refined workflow mode guidance.',
      'Added Launch Passport polish.',
    ]));
  });
});
