import {
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
      'Improved OAuth session persistence',
      'Added Daily Content Pack generation',
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
});
