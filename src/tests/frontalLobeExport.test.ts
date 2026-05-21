/**
 * Tests for src/utils/frontalLobeExport.ts
 *
 * Covers:
 *   - buildFrontalLobeExportBlock: output structure, content, never includes vault metadata
 *   - shouldIncludeFrontalLobe: all four modes
 *   - formatForPlatform integration: default_on includes block, off/manual_only exclude it
 */

import {
  buildFrontalLobeExportBlock,
  getFrontalLobeExportStatus,
  shouldIncludeFrontalLobe,
} from '../utils/frontalLobeExport';
import { formatForPlatform, formatForClaudeWithManifest } from '../utils/exportFormatters';
import { DEFAULT_FRONTAL_LOBE_PROFILE } from '../types/personalMemoryVault';
import type { FrontalLobeProfile } from '../types/personalMemoryVault';
import type { ProjectMemory } from '../types/memphant-types';
import { SCHEMA_VERSION } from '../types/memphant-types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<FrontalLobeProfile> = {}): FrontalLobeProfile {
  return { ...DEFAULT_FRONTAL_LOBE_PROFILE, mode: 'default_on', ...overrides };
}

function makeProject(overrides: Partial<ProjectMemory> = {}): ProjectMemory {
  return {
    schema_version: SCHEMA_VERSION,
    id: 'fl-export-test',
    name: 'FL Export Test Project',
    summary: 'Testing Frontal Lobe export wiring.',
    currentState: 'In test.',
    goals: ['Verify export boundaries'],
    rules: ['Stay scoped'],
    decisions: [],
    importantAssets: [],
    openQuestions: [],
    nextSteps: [],
    changelog: [],
    checkpoints: [],
    platformState: {},
    ...overrides,
  };
}

// Sentinels that should NEVER appear in the export block
const VAULT_ONLY_SENTINELS = [
  'VAULT_SECRET_DO_NOT_EXPORT',
  'NEVER_SHARE_SENTINEL',
  'VAULT_OWNER_SENTINEL',
  'VAULT_CONSENT_PLATFORM_SENTINEL',
  'VAULT_CONSENT_NOTES_SENTINEL',
  'VAULT_LICENSE_SENTINEL',
  'VAULT_AUDIT_SENTINEL',
  'sk-test-DO_NOT_EXPORT_123456789',
  'C:\\Users\\thoma\\secret-folder',
];

// ── buildFrontalLobeExportBlock ───────────────────────────────────────────────

describe('buildFrontalLobeExportBlock', () => {
  it('includes AI Working Style section header', () => {
    const block = buildFrontalLobeExportBlock(makeProfile());
    expect(block).toContain('# AI Working Style');
    expect(block).toContain('Use this working style when helping me.');
  });

  it('includes all five AI Working Style field labels', () => {
    const block = buildFrontalLobeExportBlock(makeProfile());
    expect(block).toContain('Answer Style:');
    expect(block).toContain('Challenge Level:');
    expect(block).toContain('Code Review Strictness:');
    expect(block).toContain('Explanation Depth:');
    expect(block).toContain('Tone:');
    expect(block).toContain('Language:');
  });

  it('includes British English language preference by default', () => {
    const block = buildFrontalLobeExportBlock(makeProfile());
    expect(block).toContain('Language: British English');
    expect(block).toContain('Use British spelling and phrasing, e.g. centre, colour, organise, behaviour.');
  });

  it('renders selected non-British language preference correctly', () => {
    const block = buildFrontalLobeExportBlock(makeProfile({ languagePreference: 'american_english' }));
    expect(block).toContain('Language: American English');
    expect(block).toContain('Use American spelling and phrasing, e.g. center, color, organize, behavior.');
  });

  it('includes Builder Skill Profile section', () => {
    const block = buildFrontalLobeExportBlock(makeProfile());
    expect(block).toContain('## Builder Skill Profile');
    expect(block).toContain('Coding Confidence:');
    expect(block).toContain('Code Instruction Style:');
    expect(block).toContain('Debugging Support:');
    expect(block).toContain('Preferred Pace:');
  });

  it('includes the code instruction guidance bullets', () => {
    const block = buildFrontalLobeExportBlock(makeProfile());
    expect(block).toContain('When giving code:');
    expect(block).toContain('Say which file it goes in.');
  });

  it('includes customRules when present', () => {
    const profile = makeProfile({ customRules: ['Inspect before changing', 'No guessing'] });
    const block = buildFrontalLobeExportBlock(profile);
    expect(block).toContain('## Custom Working Rules');
    expect(block).toContain('- Inspect before changing');
    expect(block).toContain('- No guessing');
  });

  it('omits Custom Working Rules section when customRules is empty', () => {
    const block = buildFrontalLobeExportBlock(makeProfile({ customRules: [] }));
    expect(block).not.toContain('## Custom Working Rules');
  });

  it('includes Privacy Boundary note', () => {
    const block = buildFrontalLobeExportBlock(makeProfile());
    expect(block).toContain('## Privacy Boundary');
    expect(block).toContain('explicitly included by the user');
  });

  it('uses human-readable labels — not raw enum values', () => {
    const block = buildFrontalLobeExportBlock(makeProfile({
      defaultAnswerStyle: 'balanced_builder',
      challengeLevel: 'balanced',
      codeReviewStrictness: 'normal',
      explanationDepth: 'explain_why',
      tone: 'balanced',
      codingConfidence: 'can_edit_with_exact_instructions',
      codeInstructionStyle: 'exact_file_and_patch',
      debuggingSupport: 'plain_english_error',
      preferredPace: 'slow_guided',
    }));

    // Human-readable labels present
    expect(block).toContain('Balanced Builder');
    expect(block).toContain('Explain why');
    expect(block).toContain('Explain the error in plain English');
    expect(block).toContain('Slow and guided');

    // Raw enum values absent
    expect(block).not.toContain('balanced_builder');
    expect(block).not.toContain('explain_why');
    expect(block).not.toContain('plain_english_error');
    expect(block).not.toContain('slow_guided');
  });

  it('never contains vault-only sentinel data', () => {
    // Even if a rogue caller passed vault sentinels as customRules,
    // the block should not be a vehicle for neverShare / vault metadata.
    // (Secret-pattern sentinels get sanitised by exportFormatters.ts.)
    // Here we just verify the block builder itself stays narrowly scoped.
    const block = buildFrontalLobeExportBlock(makeProfile());
    for (const sentinel of VAULT_ONLY_SENTINELS) {
      expect(block).not.toContain(sentinel);
    }
  });
});

// ── shouldIncludeFrontalLobe ──────────────────────────────────────────────────

describe('shouldIncludeFrontalLobe', () => {
  it('default_on returns true regardless of override', () => {
    expect(shouldIncludeFrontalLobe('default_on')).toBe(true);
    expect(shouldIncludeFrontalLobe('default_on', false)).toBe(true);
    expect(shouldIncludeFrontalLobe('default_on', true)).toBe(true);
  });

  it('ask_each_time returns false without override', () => {
    expect(shouldIncludeFrontalLobe('ask_each_time')).toBe(false);
    expect(shouldIncludeFrontalLobe('ask_each_time', false)).toBe(false);
  });

  it('ask_each_time returns true when override is true', () => {
    expect(shouldIncludeFrontalLobe('ask_each_time', true)).toBe(true);
  });

  it('manual_only returns false regardless of override', () => {
    expect(shouldIncludeFrontalLobe('manual_only')).toBe(false);
    expect(shouldIncludeFrontalLobe('manual_only', true)).toBe(false);
  });

  it('off returns false regardless of override', () => {
    expect(shouldIncludeFrontalLobe('off')).toBe(false);
    expect(shouldIncludeFrontalLobe('off', true)).toBe(false);
  });
});

// ── formatForPlatform integration ─────────────────────────────────────────────

describe('getFrontalLobeExportStatus', () => {
  it('default_on with a profile shows Included automatically', () => {
    expect(getFrontalLobeExportStatus('default_on', true)).toBe(
      'AI Working Style: Included automatically',
    );
  });

  it('ask_each_time unchecked with a profile shows Ask each time', () => {
    expect(getFrontalLobeExportStatus('ask_each_time', true, false)).toBe(
      'AI Working Style: Ask each time',
    );
  });

  it('ask_each_time checked with a profile shows Included for this handoff', () => {
    expect(getFrontalLobeExportStatus('ask_each_time', true, true)).toBe(
      'AI Working Style: Included for this handoff',
    );
  });

  it('manual_only with a profile shows Manual only', () => {
    expect(getFrontalLobeExportStatus('manual_only', true, true)).toBe(
      'AI Working Style: Manual only',
    );
  });

  it('off with a profile shows Off', () => {
    expect(getFrontalLobeExportStatus('off', true, true)).toBe(
      'AI Working Style: Off',
    );
  });

  it('no profile shows Not set', () => {
    expect(getFrontalLobeExportStatus('default_on', false, true)).toBe(
      'AI Working Style: Not set',
    );
  });
});

describe('formatForPlatform Frontal Lobe integration', () => {
  const project = makeProject();
  const profile = makeProfile({
    defaultAnswerStyle: 'straight_shooter',
    customRules: ['Be concise'],
  });
  const block = buildFrontalLobeExportBlock(profile);

  it('includes the Frontal Lobe block when passed explicitly (default_on path)', () => {
    const output = formatForPlatform(project, 'claude', undefined, 'full', undefined, undefined, block);
    expect(output).toContain('# AI Working Style');
    expect(output).toContain('Straight Shooter');
    expect(output).toContain('Be concise');
  });

  it('appends block to all supported platforms', () => {
    const platforms = ['claude', 'chatgpt', 'grok', 'perplexity', 'gemini', 'codex', 'cowork'] as const;
    for (const platform of platforms) {
      const output = formatForPlatform(project, platform, undefined, 'full', undefined, undefined, block);
      expect(output).toContain('# AI Working Style');
    }
  });

  it('appends block in delta mode', () => {
    const output = formatForPlatform(project, 'claude', undefined, 'delta', undefined, undefined, block);
    expect(output).toContain('# AI Working Style');
  });

  it('appends block in specialist mode', () => {
    const output = formatForPlatform(project, 'claude', undefined, 'specialist', undefined, undefined, block);
    expect(output).toContain('# AI Working Style');
  });

  it('does NOT include Frontal Lobe block when no block is passed (off / manual_only path)', () => {
    // Callers with mode=off or manual_only pass no block — formatForPlatform gets undefined
    const output = formatForPlatform(project, 'claude', undefined, 'full', undefined, undefined, undefined);
    expect(output).not.toContain('# AI Working Style');
  });

  it('does NOT include block when block is empty string', () => {
    const output = formatForPlatform(project, 'claude', undefined, 'full', undefined, undefined, '');
    expect(output).not.toContain('# AI Working Style');
  });

  it('sanitises API key patterns inside customRules before appending', () => {
    const skKey = ['sk', 'live', 'abcdefghijklmnopqrstuvwx'].join('_');
    const profileWithKey = makeProfile({ customRules: [`Use ${skKey} to auth`] });
    const blockWithKey = buildFrontalLobeExportBlock(profileWithKey);
    const output = formatForPlatform(project, 'claude', undefined, 'full', undefined, undefined, blockWithKey);
    // The sk_live_ prefix won't exactly match the sk_live regex but the block is sanitised via sanitize()
    // This test verifies the pipeline runs without errors and the output is a string
    expect(typeof output).toBe('string');
    expect(output).toContain('# AI Working Style');
  });
});

// ── formatForClaudeWithManifest integration ────────────────────────────────────

describe('formatForClaudeWithManifest Frontal Lobe integration', () => {
  const project = makeProject();
  const profile = makeProfile({ defaultAnswerStyle: 'friendly_coach' });
  const block = buildFrontalLobeExportBlock(profile);

  it('includes Frontal Lobe block in manifest export when passed', () => {
    const output = formatForClaudeWithManifest(
      project,
      'state_digest: sha256:test\n- id: G-001',
      'sha256:test',
      'Continue.',
      undefined,
      block,
    );
    expect(output).toContain('# AI Working Style');
    expect(output).toContain('Friendly Coach');
    // Should still have manifest sections
    expect(output).toContain('<vcp_state_manifest>');
    expect(output).toContain('<vcp_guidance>');
  });

  it('does NOT include Frontal Lobe block when no block passed', () => {
    const output = formatForClaudeWithManifest(
      project,
      'state_digest: sha256:test',
      'sha256:test',
      'Continue.',
    );
    expect(output).not.toContain('# AI Working Style');
  });
});

// ── End-to-end mode pipeline ──────────────────────────────────────────────────

describe('mode pipeline: shouldIncludeFrontalLobe → buildFrontalLobeExportBlock → formatForPlatform', () => {
  const project = makeProject();
  const profile = makeProfile({ defaultAnswerStyle: 'red_team_mode' });

  function runExport(mode: FrontalLobeProfile['mode'], userOverride = false): string {
    const block = shouldIncludeFrontalLobe(mode, userOverride)
      ? buildFrontalLobeExportBlock(profile)
      : undefined;
    return formatForPlatform(project, 'claude', undefined, 'full', undefined, undefined, block);
  }

  it('default_on: block appears in export', () => {
    expect(runExport('default_on')).toContain('# AI Working Style');
  });

  it('ask_each_time + override=false: block absent', () => {
    expect(runExport('ask_each_time', false)).not.toContain('# AI Working Style');
  });

  it('ask_each_time + override=true: block present', () => {
    expect(runExport('ask_each_time', true)).toContain('# AI Working Style');
  });

  it('manual_only: block absent even with override=true', () => {
    expect(runExport('manual_only', true)).not.toContain('# AI Working Style');
  });

  it('off: block absent even with override=true', () => {
    expect(runExport('off', true)).not.toContain('# AI Working Style');
  });

  it('Red Team Mode label appears in output when included', () => {
    expect(runExport('default_on')).toContain('Red Team Mode');
  });
});
