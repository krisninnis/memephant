import {
  getRecentProgressNoteItems,
  getShippingHighlights,
  isLowSignalShippingEntry,
  summarizeShippingChange,
} from '../utils/shippingHighlights';
import type { ProjectMemory } from '../types/memphant-types';

const project: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'shipping-highlights-project',
  name: 'Memephant Launch Studio',
  summary: 'Help founders turn project memory into clear launch content.',
  currentState: 'Launch Studio now has clearer content generation.',
  goals: ['Create useful public launch updates'],
  rules: [],
  decisions: [],
  nextSteps: ['Record a demo'],
  openQuestions: [],
  importantAssets: [],
  changelog: [],
  checkpoints: [],
  platformState: {},
};

describe('shipping highlights', () => {
  it('filters low-signal internal changelog entries', () => {
    expect(isLowSignalShippingEntry('4 decisions added by AI')).toBe(true);
    expect(isLowSignalShippingEntry('7 items added by AI')).toBe(true);
    expect(isLowSignalShippingEntry('Last session summary updated')).toBe(true);
    expect(isLowSignalShippingEntry('Metadata changed')).toBe(true);
    expect(isLowSignalShippingEntry('Copied project context for ChatGPT')).toBe(true);
    expect(isLowSignalShippingEntry('Export checkpoint created')).toBe(true);
    expect(isLowSignalShippingEntry('Added Daily Content Pack generation')).toBe(false);
  });

  it('converts technical/internal phrasing into clearer public summaries', () => {
    expect(summarizeShippingChange('Implemented Content Readiness scoring by AI.'))
      .toBe('Added Content Readiness scoring');
    expect(summarizeShippingChange('Fixed OAuth session persistence.'))
      .toBe('Improved OAuth session persistence');
    expect(summarizeShippingChange('Refined onboarding clarity.'))
      .toBe('Improved onboarding clarity');
  });

  it('suppresses duplicates and prioritises launch-worthy progress deterministically', () => {
    const highlights = getShippingHighlights({
      ...project,
      changelog: [
        {
          timestamp: '2026-05-28T09:00:00.000Z',
          field: 'general',
          action: 'updated',
          summary: '4 decisions added by AI',
        },
        {
          timestamp: '2026-05-28T10:00:00.000Z',
          field: 'launch',
          action: 'added',
          summary: 'Added Daily Content Pack generation.',
        },
        {
          timestamp: '2026-05-28T11:00:00.000Z',
          field: 'launch',
          action: 'added',
          summary: 'Added Daily Content Pack generation.',
        },
        {
          timestamp: '2026-05-28T12:00:00.000Z',
          field: 'auth',
          action: 'updated',
          summary: 'Fixed OAuth session persistence.',
        },
        {
          timestamp: '2026-05-28T13:00:00.000Z',
          field: 'onboarding',
          action: 'updated',
          summary: 'Refined onboarding clarity.',
        },
      ],
    });

    expect(highlights).toEqual([
      'Added Daily Content Pack generation',
      'Improved OAuth session persistence',
      'Improved onboarding clarity',
    ]);
  });

  it('uses meaningful in-progress context when changelog has no public shipping signal', () => {
    const highlights = getShippingHighlights({
      ...project,
      inProgress: ['Improving demo clip captions for Launch Studio'],
      changelog: [
        {
          timestamp: '2026-05-28T09:00:00.000Z',
          field: 'general',
          action: 'updated',
          summary: '2 items added by AI',
        },
      ],
    });

    expect(highlights).toEqual(['Improving demo clip captions for Launch Studio']);
  });

  it('prioritises user-entered recent progress over empty or noisy project history', () => {
    const shippedToday = [
      'Added Launch Studio tabs.',
      'Improved modal scrolling.',
      'Added Social Bridge sharing actions.',
      'Polished app-wide spacing.',
    ].join('\n');
    const highlights = getShippingHighlights({
      ...project,
      recentProgressNote: shippedToday,
      changelog: [
        {
          timestamp: '2026-05-28T09:00:00.000Z',
          field: 'session',
          action: 'updated',
          summary: 'Last session summary updated',
        },
      ],
    });

    expect(highlights).toEqual([
      'Added Launch Studio tabs',
      'Improved modal scrolling',
      'Added Social Bridge sharing actions',
      'Improved app-wide spacing',
    ]);
    expect(getRecentProgressNoteItems(shippedToday)).toEqual([
      'Added Launch Studio tabs.',
      'Improved modal scrolling.',
      'Added Social Bridge sharing actions.',
      'Polished app-wide spacing.',
    ]);
  });

  it('keeps concise user-entered shipped notes when they are real progress', () => {
    const highlights = getShippingHighlights({
      ...project,
      recentProgressNote: 'Fixed sign-in.',
      changelog: [],
    });

    expect(highlights).toEqual(['Improved sign-in']);
  });

  it('splits user-entered recent progress by sentence boundaries', () => {
    const highlights = getShippingHighlights({
      ...project,
      recentProgressNote: 'Added Launch Studio tabs. Improved modal scrolling. Fixed sign-in.',
      changelog: [],
    });

    expect(getRecentProgressNoteItems('Added Launch Studio tabs. Improved modal scrolling. Fixed sign-in.'))
      .toEqual([
        'Added Launch Studio tabs.',
        'Improved modal scrolling.',
        'Fixed sign-in.',
      ]);
    expect(highlights).toEqual([
      'Added Launch Studio tabs',
      'Improved modal scrolling',
      'Improved sign-in',
    ]);
  });

  it('trusts meaningful user-entered progress even without recognised action or priority terms', () => {
    const highlights = getShippingHighlights({
      ...project,
      currentState: 'Project updated.',
      recentProgressNote: 'The product story finally makes sense to new founders.',
      changelog: [],
    });

    expect(highlights).toEqual(['The product story finally makes sense to new founders']);
  });

  it('still rejects copied export and checkpoint noise from user-entered progress', () => {
    const highlights = getShippingHighlights({
      ...project,
      currentState: 'Project updated.',
      recentProgressNote: [
        'Copied project context for ChatGPT.',
        'Export checkpoint created.',
        'Checkpoint saved.',
      ].join('\n'),
      changelog: [],
    });

    expect(highlights).toEqual([]);
  });

  it('suppresses maintenance-only updates when generating highlights', () => {
    const highlights = getShippingHighlights({
      ...project,
      changelog: [
        {
          timestamp: '2026-05-28T09:00:00.000Z',
          field: 'session',
          action: 'updated',
          summary: 'Last session summary updated',
        },
        {
          timestamp: '2026-05-28T10:00:00.000Z',
          field: 'metadata',
          action: 'updated',
          summary: 'Metadata changed',
        },
        {
          timestamp: '2026-05-28T11:00:00.000Z',
          field: 'launch',
          action: 'added',
          summary: 'Added Export History compare.',
        },
      ],
    });

    expect(highlights).toEqual(['Added Export History compare']);
  });
});
