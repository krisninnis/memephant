import { formatForClaudeWithManifest, formatForPlatform } from '../utils/exportFormatters';
import {
  generateContextPassport,
  generateCustomPassportText,
  type CustomPlatform,
} from '../utils/passportGenerator';
import { appendMemoryBridgeToExport, buildMemoryBridgeBlock } from '../utils/memoryBridge';
import {
  createConsentLedgerEvent,
  createDefaultPersonalMemoryVault,
  createPersonalMemoryEntry,
  type PersonalMemoryVault,
} from '../types/personalMemoryVault';
import { SCHEMA_VERSION, type ExportMode, type Platform, type ProjectMemory } from '../types/memphant-types';
import {
  PERSONAL_MEMORY_VAULT_STORAGE_KEY,
  savePersonalMemoryVault,
} from '../services/personalMemoryVaultStorage';

const VAULT_SECRET_SENTINEL = 'VAULT_SECRET_DO_NOT_EXPORT';
const PRIVATE_MEMORY_SENTINEL = 'PRIVATE_MEMORY_SENTINEL';
const NEVER_SHARE_SENTINEL = 'NEVER_SHARE_SENTINEL';
const LOCAL_PATH_SENTINEL = 'C:\\Users\\thoma\\secret-folder';
const FAKE_API_KEY_SENTINEL = ['sk', 'test-DO_NOT_EXPORT_123456789'].join('-');
const VAULT_METADATA_SENTINELS = [
  'VAULT_OWNER_SENTINEL',
  'VAULT_CONSENT_PLATFORM_SENTINEL',
  'VAULT_CONSENT_TARGET_SENTINEL',
  'VAULT_CONSENT_NOTES_SENTINEL',
  'VAULT_LICENSE_SENTINEL',
  'VAULT_AUDIT_SENTINEL',
];
const ALL_VAULT_SENTINELS = [
  VAULT_SECRET_SENTINEL,
  PRIVATE_MEMORY_SENTINEL,
  NEVER_SHARE_SENTINEL,
  LOCAL_PATH_SENTINEL,
  FAKE_API_KEY_SENTINEL,
  ...VAULT_METADATA_SENTINELS,
];

function makeProject(): ProjectMemory {
  return {
    schema_version: SCHEMA_VERSION,
    id: 'vault-boundary-project',
    name: 'Vault Boundary Project',
    summary: 'Project-only context for export boundary tests.',
    currentState: 'Confirming Personal Memory Vault data remains outside project handoffs.',
    goals: ['Keep personal and project memory separate'],
    rules: ['Never include local vault data in project exports without explicit future permission'],
    decisions: [
      {
        decision: 'Keep Personal Memory Vault local-only',
        rationale: 'Private user data must not leak into project handoff surfaces.',
      },
    ],
    importantAssets: ['src/utils/exportFormatters.ts', 'src/utils/passportGenerator.ts'],
    openQuestions: ['Which export surfaces should remain project-only?'],
    nextSteps: ['Run boundary tests across all project export surfaces'],
    changelog: [
      {
        timestamp: '2026-05-09T10:00:00.000Z',
        field: 'tests',
        action: 'added',
        summary: 'Added project export boundary coverage',
        source: 'app',
      },
    ],
    checkpoints: [],
    platformState: {},
    inProgress: ['Writing project/vault boundary tests'],
    lastSessionSummary: 'Consent Receipt v1 exists, but project exports must stay vault-free.',
    openQuestion: 'How do we prevent accidental future vault leakage?',
    projectCharter: 'Project handoffs must remain scoped to project memory.',
    aiInstructions: 'Stay inside project memory unless the user explicitly opts into a future vault feature.',
  };
}

function makePopulatedVault(): PersonalMemoryVault {
  const vault = createDefaultPersonalMemoryVault('2026-05-09T12:00:00.000Z');
  vault.ownerProfile = {
    displayName: 'VAULT_OWNER_SENTINEL',
    bio: `${PRIVATE_MEMORY_SENTINEL} ${VAULT_SECRET_SENTINEL}`,
    locationHint: LOCAL_PATH_SENTINEL,
  };
  vault.preferences = [
    createPersonalMemoryEntry(`${PRIVATE_MEMORY_SENTINEL} prefers concise AI answers`, {
      id: 'vault-pref-sentinel',
      label: 'PRIVATE_MEMORY_SENTINEL preference',
      category: 'preference',
      updatedAt: vault.updatedAt,
    }),
  ];
  vault.workStyle = [
    createPersonalMemoryEntry(`${VAULT_SECRET_SENTINEL} work style`, {
      id: 'vault-work-sentinel',
      category: 'custom',
      updatedAt: vault.updatedAt,
    }),
  ];
  vault.privateNotes = [
    createPersonalMemoryEntry(`Never expose ${FAKE_API_KEY_SENTINEL} or ${LOCAL_PATH_SENTINEL}`, {
      id: 'vault-private-note-sentinel',
      category: 'custom',
      updatedAt: vault.updatedAt,
    }),
  ];
  vault.neverShare = [
    NEVER_SHARE_SENTINEL,
    LOCAL_PATH_SENTINEL,
    FAKE_API_KEY_SENTINEL,
  ];
  vault.platformPermissions = {
    chatgpt: {
      permission: 'never',
      allowedCategories: [],
      deniedCategories: ['VAULT_METADATA_SENTINEL_DENIED_CATEGORY'],
      updatedAt: vault.updatedAt,
    },
  };
  vault.dataLicensingPreferences = {
    ...vault.dataLicensingPreferences,
    deniedCategories: ['VAULT_LICENSE_SENTINEL'],
    notes: 'VAULT_LICENSE_SENTINEL must stay outside project exports.',
  };
  vault.consentLedger = [
    createConsentLedgerEvent({
      id: 'vault-consent-sentinel',
      createdAt: vault.updatedAt,
      action: 'consent_refused',
      scope: 'platform_sharing',
      platform: 'VAULT_CONSENT_PLATFORM_SENTINEL',
      target: 'VAULT_CONSENT_TARGET_SENTINEL',
      notes: 'VAULT_CONSENT_NOTES_SENTINEL',
    }),
  ];
  vault.auditLog = [
    {
      id: 'vault-audit-sentinel',
      timestamp: vault.updatedAt,
      action: 'created',
      summary: 'VAULT_AUDIT_SENTINEL',
      source: 'user',
    },
  ];

  return vault;
}

function seedHostileVault(): void {
  const vault = makePopulatedVault();
  savePersonalMemoryVault(vault);
  const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY) ?? '';

  for (const sentinel of ALL_VAULT_SENTINELS) {
    if (sentinel === LOCAL_PATH_SENTINEL) {
      expect(stored).toContain(LOCAL_PATH_SENTINEL.replace(/\\/g, '\\\\'));
    } else {
      expect(stored).toContain(sentinel);
    }
  }
}

function expectNoVaultSentinels(output: string): void {
  for (const sentinel of ALL_VAULT_SENTINELS) {
    expect(output).not.toContain(sentinel);
  }
}

describe('Personal Memory Vault / project export boundary', () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedHostileVault();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('never includes Personal Memory Vault values in any project export mode or platform handoff', () => {
    const project = makeProject();
    const platforms: Platform[] = ['claude', 'chatgpt', 'grok', 'perplexity', 'gemini', 'codex', 'cowork'];
    const modes: ExportMode[] = ['full', 'delta', 'specialist', 'smart'];

    for (const platform of platforms) {
      for (const mode of modes) {
        const output = formatForPlatform(project, platform, 'Review this project boundary test.', mode);
        expectNoVaultSentinels(output);
      }
    }
  });

  it('never includes Personal Memory Vault values in Claude manifest handoffs', () => {
    const output = formatForClaudeWithManifest(
      makeProject(),
      'state_digest: sha256:project-only\n- id: G-001 project-only goal',
      'sha256:project-only',
      'Continue with project-only context.',
    );

    expectNoVaultSentinels(output);
  });

  it('never includes Personal Memory Vault values in Context Passport formats', () => {
    const passport = generateContextPassport(makeProject());

    for (const output of Object.values(passport.formats)) {
      expectNoVaultSentinels(output);
    }
  });

  it('never includes Personal Memory Vault values in custom Context Passport formats', () => {
    const baseFormats: CustomPlatform['baseFormat'][] = [
      'markdown',
      'xml-like',
      'compact',
      'developer-brief',
    ];

    for (const baseFormat of baseFormats) {
      const output = generateCustomPassportText(makeProject(), {
        id: `custom-boundary-${baseFormat}`,
        name: `Boundary ${baseFormat}`,
        baseFormat,
        customInstruction: 'Use only the supplied project context.',
        includeFiles: true,
        includeRecentChanges: true,
      });
      expectNoVaultSentinels(output);
    }
  });

  it('never includes Personal Memory Vault values in Memory Bridge output', () => {
    const project = makeProject();
    const bridge = buildMemoryBridgeBlock(project, 'chatgpt');
    const appended = appendMemoryBridgeToExport('BASE PROJECT EXPORT', project, 'claude');

    expectNoVaultSentinels(bridge);
    expectNoVaultSentinels(appended);
  });
});
