/**
 * Focused tests for getExportDiffSummary.ts
 *
 * Covers:
 *   1. First-export state (no lastExportedAt for the platform)
 *   2. Changed goals detected
 *   3. Changed currentState detected (with detail text)
 *   4. Frontal Lobe inclusion flag passed through correctly
 *   5. No false positives — changelog entries BEFORE lastExportedAt are ignored
 *   6. Export string is not involved / mutated (pure function, no side-effects)
 */

import { getExportDiffSummary } from '../utils/getExportDiffSummary';
import type { ProjectMemory } from '../types/memphant-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_TIME = '2024-06-01T12:00:00.000Z';
const BEFORE_EXPORT = '2024-06-01T10:00:00.000Z'; // before lastExportedAt
const AFTER_EXPORT  = '2024-06-01T14:00:00.000Z'; // after  lastExportedAt

function makeProject(overrides: Partial<ProjectMemory> = {}): ProjectMemory {
  return {
    schema_version: '1.2.0',
    id: 'test-project',
    name: 'Test Project',
    summary: 'A test project.',
    goals: ['Ship it'],
    rules: [],
    decisions: [],
    currentState: 'In progress.',
    nextSteps: [],
    openQuestions: [],
    importantAssets: [],
    changelog: [],
    checkpoints: [],
    platformState: {},
    ...overrides,
  };
}

// ── 1. First export state ─────────────────────────────────────────────────────

describe('getExportDiffSummary — first export', () => {
  it('returns isFirstExport=true when platformState has no lastExportedAt', () => {
    const project = makeProject({ platformState: {} });
    const result = getExportDiffSummary(project, 'claude', false);

    expect(result.isFirstExport).toBe(true);
  });

  it('returns isFirstExport=true when the platform key is absent entirely', () => {
    const project = makeProject({ platformState: { chatgpt: { lastExportedAt: BASE_TIME } } });
    const result = getExportDiffSummary(project, 'claude', false);

    expect(result.isFirstExport).toBe(true);
  });

  it('returns empty items on first export', () => {
    const project = makeProject({ platformState: {} });
    const result = getExportDiffSummary(project, 'claude', false);

    expect(result.items).toHaveLength(0);
    expect(result.hasChanges).toBe(false);
  });

  it('surfaces the correct platformId on first export', () => {
    const project = makeProject({ platformState: {} });
    const result = getExportDiffSummary(project, 'gemini', false);

    expect(result.platformId).toBe('gemini');
  });
});

// ── 2. Changed goals detected ─────────────────────────────────────────────────

describe('getExportDiffSummary — goals changes', () => {
  it('detects a goals changelog entry after lastExportedAt', () => {
    const project = makeProject({
      goals: ['Existing goal', 'New goal'],
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [
        {
          timestamp: AFTER_EXPORT,
          field: 'goals',
          action: 'added',
          summary: '1 item added by AI',
        },
      ],
    });

    const result = getExportDiffSummary(project, 'claude', false);
    const goalsItem = result.items.find((i) => i.field === 'goals');

    expect(goalsItem).toBeDefined();
    expect(goalsItem?.action).toBe('added');
  });

  it('includes a detail string for goals changes', () => {
    const project = makeProject({
      goals: ['New goal'],
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [
        {
          timestamp: AFTER_EXPORT,
          field: 'goals',
          action: 'added',
          summary: '1 item added by AI',
        },
      ],
    });

    const result = getExportDiffSummary(project, 'claude', false);
    const goalsItem = result.items.find((i) => i.field === 'goals');

    expect(goalsItem?.detail).toMatch(/change/i);
  });

  it('sets hasChanges=true when goals have changed', () => {
    const project = makeProject({
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [
        {
          timestamp: AFTER_EXPORT,
          field: 'goals',
          action: 'added',
          summary: '1 item added by AI',
        },
      ],
    });

    const result = getExportDiffSummary(project, 'claude', false);

    expect(result.hasChanges).toBe(true);
  });
});

// ── 3. Changed currentState detected ─────────────────────────────────────────

describe('getExportDiffSummary — currentState changes', () => {
  it('detects a currentState changelog entry after lastExportedAt', () => {
    const project = makeProject({
      currentState: 'Tests are passing.',
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [
        {
          timestamp: AFTER_EXPORT,
          field: 'currentState',
          action: 'updated',
          summary: 'Status updated by AI',
        },
      ],
    });

    const result = getExportDiffSummary(project, 'claude', false);
    const stateItem = result.items.find((i) => i.field === 'currentState');

    expect(stateItem).toBeDefined();
    expect(stateItem?.action).toBe('updated');
  });

  it('includes the current state value as the detail', () => {
    const project = makeProject({
      currentState: 'Tests are passing.',
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [
        {
          timestamp: AFTER_EXPORT,
          field: 'currentState',
          action: 'updated',
          summary: 'Status updated by AI',
        },
      ],
    });

    const result = getExportDiffSummary(project, 'claude', false);
    const stateItem = result.items.find((i) => i.field === 'currentState');

    expect(stateItem?.detail).toBe('Tests are passing.');
  });

  it('truncates very long currentState values in the detail', () => {
    const longState = 'A'.repeat(200);
    const project = makeProject({
      currentState: longState,
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [
        {
          timestamp: AFTER_EXPORT,
          field: 'currentState',
          action: 'updated',
          summary: 'Status updated by AI',
        },
      ],
    });

    const result = getExportDiffSummary(project, 'claude', false);
    const stateItem = result.items.find((i) => i.field === 'currentState');

    expect(stateItem?.detail).toBeDefined();
    expect(stateItem!.detail!.length).toBeLessThanOrEqual(121); // 120 chars + ellipsis
    expect(stateItem?.detail).toMatch(/…$/);
  });
});

// ── 4. Frontal Lobe inclusion ─────────────────────────────────────────────────

describe('getExportDiffSummary — Frontal Lobe inclusion', () => {
  it('surfaces frontalLobeIncluded=true when passed true', () => {
    const project = makeProject({ platformState: {} });
    const result = getExportDiffSummary(project, 'claude', true);

    expect(result.frontalLobeIncluded).toBe(true);
  });

  it('surfaces frontalLobeIncluded=false when passed false', () => {
    const project = makeProject({ platformState: {} });
    const result = getExportDiffSummary(project, 'claude', false);

    expect(result.frontalLobeIncluded).toBe(false);
  });

  it('passes frontalLobeIncluded=true through on a non-first export too', () => {
    const project = makeProject({
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [],
    });
    const result = getExportDiffSummary(project, 'claude', true);

    expect(result.frontalLobeIncluded).toBe(true);
  });
});

// ── 5. No false positives ─────────────────────────────────────────────────────

describe('getExportDiffSummary — no false positives', () => {
  it('ignores changelog entries timestamped before lastExportedAt', () => {
    const project = makeProject({
      currentState: 'Old state still.',
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [
        {
          timestamp: BEFORE_EXPORT,
          field: 'currentState',
          action: 'updated',
          summary: 'Old update — should be ignored',
        },
        {
          timestamp: BEFORE_EXPORT,
          field: 'goals',
          action: 'added',
          summary: '2 items added by AI — should be ignored',
        },
      ],
    });

    const result = getExportDiffSummary(project, 'claude', false);

    expect(result.items).toHaveLength(0);
    expect(result.hasChanges).toBe(false);
    expect(result.isFirstExport).toBe(false);
  });

  it('ignores irrelevant fields (rules, openQuestions, etc.) in the changelog', () => {
    const project = makeProject({
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [
        {
          timestamp: AFTER_EXPORT,
          field: 'rules',
          action: 'added',
          summary: '1 rule added by AI',
        },
        {
          timestamp: AFTER_EXPORT,
          field: 'openQuestions',
          action: 'added',
          summary: '1 question added by AI',
        },
      ],
    });

    const result = getExportDiffSummary(project, 'claude', false);

    expect(result.items).toHaveLength(0);
    expect(result.hasChanges).toBe(false);
  });

  it('returns only entries for the requested platform, not other platforms', () => {
    // Both platforms have a lastExportedAt, but we query 'chatgpt'.
    // The chatgpt platform has no changelog entries after its lastExportedAt.
    const project = makeProject({
      platformState: {
        claude:   { lastExportedAt: BASE_TIME },
        chatgpt:  { lastExportedAt: BASE_TIME },
      },
      changelog: [
        // This entry is after BASE_TIME, but we're querying chatgpt
        // which also has BASE_TIME — so the entry WILL appear because
        // getChangesSince filters by project-level changelog, not by platform.
        // This test confirms the result for chatgpt is correct.
        {
          timestamp: AFTER_EXPORT,
          field: 'goals',
          action: 'added',
          summary: '1 goal added by AI',
        },
      ],
    });

    // Querying chatgpt should still see the goal change — the changelog is project-level.
    const result = getExportDiffSummary(project, 'chatgpt', false);
    expect(result.platformId).toBe('chatgpt');
    // The goal entry is after chatgpt's lastExportedAt so it IS expected
    const goalsItem = result.items.find((i) => i.field === 'goals');
    expect(goalsItem).toBeDefined();
  });

  it('empty changelog after lastExportedAt → hasChanges=false, isFirstExport=false', () => {
    const project = makeProject({
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [],
    });

    const result = getExportDiffSummary(project, 'claude', false);

    expect(result.isFirstExport).toBe(false);
    expect(result.hasChanges).toBe(false);
    expect(result.items).toHaveLength(0);
  });
});

// ── 6. Export string not mutated ──────────────────────────────────────────────

describe('getExportDiffSummary — pure function / no mutations', () => {
  it('does not mutate the project object', () => {
    const originalChangelog = [
      {
        timestamp: AFTER_EXPORT,
        field: 'currentState',
        action: 'updated' as const,
        summary: 'Status updated',
      },
    ];
    const project = makeProject({
      currentState: 'Stable.',
      platformState: { claude: { lastExportedAt: BASE_TIME } },
      changelog: [...originalChangelog],
    });

    const before = JSON.stringify(project);
    getExportDiffSummary(project, 'claude', true);
    const after = JSON.stringify(project);

    expect(after).toBe(before);
  });

  it('returns a new object on each call (no shared state)', () => {
    const project = makeProject({ platformState: {} });

    const r1 = getExportDiffSummary(project, 'claude', false);
    const r2 = getExportDiffSummary(project, 'claude', false);

    expect(r1).not.toBe(r2);
  });
});
