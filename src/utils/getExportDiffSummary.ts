/**
 * getExportDiffSummary.ts
 *
 * Generates a structured diff summary of project changes since the last export
 * for a given platform.  Used by the Export Inspector modal.
 *
 * CONTRACT:
 *   - Pure function — no side-effects, no mutations.
 *   - Does NOT parse raw export text.
 *   - Returns { isFirstExport: true } when no previous export exists for the platform.
 *   - Reuses getChangesSince for changelog filtering.
 */

import type { ChangelogEntry, ProjectMemory } from '../types/memphant-types';
import { getChangesSince } from './getChangesSince';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExportDiffItem {
  /** Internal field name (e.g. "currentState", "goals"). */
  field: string;
  /** Human-readable label shown in the panel. */
  label: string;
  /** Most recent action recorded for this field since the last export. */
  action: 'updated' | 'added' | 'removed';
  /**
   * Optional short context.
   * For currentState: the truncated current value.
   * For array fields: a "N change(s)" count.
   */
  detail?: string;
}

export interface ExportDiffSummary {
  /** True when no previous export exists for this platform. */
  isFirstExport: boolean;
  /** The platform this summary is for. */
  platformId: string;
  /** Meaningful changes detected since the last export. */
  items: ExportDiffItem[];
  /** Whether the Frontal Lobe / AI Working Style block is included in this export. */
  frontalLobeIncluded: boolean;
  /** Convenience flag — true when items.length > 0. */
  hasChanges: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Labels match CLAUDE.md UI Label Mappings and diffEngine.ts fieldLabel() for consistency.
const FIELD_LABELS: Record<string, string> = {
  currentState: 'What this project is about',
  goals: 'Goals',
  decisions: 'Key Decisions',
  nextSteps: 'Next Steps',
  importantAssets: 'Important Files & Assets',
  summary: 'Project summary',
};

/**
 * Fields surfaced in the diff panel.
 * Kept deliberately focused — rules, openQuestions, etc. are lower signal
 * during a typical export review and are omitted to reduce noise.
 */
const RELEVANT_FIELDS = new Set([
  'currentState',
  'goals',
  'decisions',
  'nextSteps',
  'importantAssets',
]);

const DETAIL_MAX_CHARS = 120;

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function describeArrayChanges(entries: ChangelogEntry[]): string {
  const n = entries.length;
  return n === 1 ? '1 change' : `${n} changes`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a structured diff summary for the Export Inspector modal.
 *
 * @param project          The active project (read-only).
 * @param platformId       The platform being exported to.
 * @param frontalLobeIncluded  Whether the AI Working Style block will appear in this export.
 */
export function getExportDiffSummary(
  project: ProjectMemory,
  platformId: string,
  frontalLobeIncluded: boolean,
): ExportDiffSummary {
  const lastExportedAt = project.platformState?.[platformId]?.lastExportedAt;

  // No previous export for this platform.
  if (!lastExportedAt) {
    return {
      isFirstExport: true,
      platformId,
      items: [],
      frontalLobeIncluded,
      hasChanges: false,
    };
  }

  // All changelog entries recorded after the last export timestamp.
  const changesSince = getChangesSince(project, lastExportedAt);

  // Group entries by field — preserves chronological order within each group.
  const byField = new Map<string, ChangelogEntry[]>();
  for (const entry of changesSince) {
    if (!RELEVANT_FIELDS.has(entry.field)) continue;
    const bucket = byField.get(entry.field) ?? [];
    bucket.push(entry);
    byField.set(entry.field, bucket);
  }

  const items: ExportDiffItem[] = [];

  for (const [field, entries] of byField) {
    const mostRecent = entries[entries.length - 1];
    if (!mostRecent) continue;

    let detail: string | undefined;

    if (field === 'currentState') {
      const val = project.currentState?.trim() ?? '';
      detail = val ? truncate(val, DETAIL_MAX_CHARS) : undefined;
    } else {
      // Array fields: surface the number of logged change batches.
      detail = describeArrayChanges(entries);
    }

    items.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      action: mostRecent.action as ExportDiffItem['action'],
      detail,
    });
  }

  return {
    isFirstExport: false,
    platformId,
    items,
    frontalLobeIncluded,
    hasChanges: items.length > 0,
  };
}
