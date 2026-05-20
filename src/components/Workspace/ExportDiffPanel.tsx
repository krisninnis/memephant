/**
 * ExportDiffPanel — compact read-only diff summary for the Export Inspector modal.
 *
 * Placed above the raw export textarea. Shows which project fields changed since
 * the last export for the selected platform, plus Frontal Lobe inclusion state.
 *
 * CONTRACT:
 *   - Read-only: never mutates project state.
 *   - Receives an ExportDiffSummary — does not call getExportDiffSummary itself.
 *   - Styling matches the existing Export Inspector modal (dark glass, subtle borders).
 */

import type { ExportDiffItem, ExportDiffSummary } from '../../utils/getExportDiffSummary';

// ── Sub-components ────────────────────────────────────────────────────────────

function DiffItemRow({ item }: { item: ExportDiffItem }) {
  const actionBadgeColor =
    item.action === 'added'
      ? 'rgba(52, 211, 153, 0.75)'   // green-ish
      : item.action === 'removed'
        ? 'rgba(248, 113, 113, 0.75)' // red-ish
        : 'rgba(148, 163, 184, 0.75)'; // slate (updated)

  const actionLabel =
    item.action === 'added' ? 'added' : item.action === 'removed' ? 'removed' : 'changed';

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        padding: '4px 0',
        fontSize: '0.83rem',
        lineHeight: 1.5,
        color: '#f8fafc',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Field label */}
      <span
        style={{
          flexShrink: 0,
          minWidth: '110px',
          color: 'rgba(248,250,252,0.75)',
          fontWeight: 600,
        }}
      >
        {item.label}
      </span>

      {/* Action badge */}
      <span
        style={{
          flexShrink: 0,
          fontSize: '0.73rem',
          fontWeight: 700,
          color: actionBadgeColor,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {actionLabel}
      </span>

      {/* Optional detail */}
      {item.detail && (
        <span
          style={{
            color: 'rgba(248,250,252,0.55)',
            fontSize: '0.81rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
          title={item.detail}
        >
          {item.detail}
        </span>
      )}
    </li>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ExportDiffPanelProps {
  summary: ExportDiffSummary;
}

export function ExportDiffPanel({ summary }: ExportDiffPanelProps) {
  const { isFirstExport, items, frontalLobeIncluded, hasChanges } = summary;

  return (
    <div
      aria-label="Changes since last export"
      style={{
        marginBottom: '12px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '7px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: '0.74rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'rgba(248,250,252,0.45)',
        }}
      >
        Changes since last export
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px' }}>
        {isFirstExport ? (
          <p
            style={{
              margin: '0 0 8px',
              fontSize: '0.85rem',
              color: 'rgba(248,250,252,0.65)',
              fontStyle: 'italic',
            }}
          >
            First export for this platform.
          </p>
        ) : hasChanges ? (
          <ul
            style={{
              margin: '0 0 8px',
              padding: 0,
              listStyle: 'none',
            }}
          >
            {items.map((item) => (
              <DiffItemRow key={item.field} item={item} />
            ))}
          </ul>
        ) : (
          <p
            style={{
              margin: '0 0 8px',
              fontSize: '0.85rem',
              color: 'rgba(248,250,252,0.45)',
            }}
          >
            No tracked changes since last export.
          </p>
        )}

        {/* Frontal Lobe status */}
        <p
          style={{
            margin: 0,
            fontSize: '0.8rem',
            color: frontalLobeIncluded
              ? 'rgba(52, 211, 153, 0.8)'
              : 'rgba(248,250,252,0.38)',
          }}
          aria-label="AI Working Style inclusion"
        >
          AI Working Style:{' '}
          <strong>{frontalLobeIncluded ? 'Included in this export' : 'Not included'}</strong>
        </p>
      </div>
    </div>
  );
}

export default ExportDiffPanel;
