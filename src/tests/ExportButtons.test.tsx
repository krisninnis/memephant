import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ExportButtons } from '../components/Workspace/ExportButtons';
import type { ProjectMemory } from '../types/memphant-types';
import { DEFAULT_SETTINGS } from '../types/memphant-types';
import { copyExportToClipboard } from '../services/tauriActions';

const mockProject: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'export-preview-project',
  name: 'Export Preview Project',
  summary: 'A project for export preview tests.',
  goals: ['Preview before copying'],
  rules: ['Keep vault private'],
  decisions: [],
  currentState: 'Testing export inspector.',
  nextSteps: ['Copy safely'],
  openQuestions: [],
  importantAssets: [],
  changelog: [],
  checkpoints: [],
  platformState: {},
};

const mockProjectStoreState = {
  targetPlatform: 'claude',
  setTargetPlatform: jest.fn(),
  currentTask: 'Keep going',
  showToast: jest.fn(),
  settings: {
    ...DEFAULT_SETTINGS,
    privacy: {
      ...DEFAULT_SETTINGS.privacy,
      secretsScannerLevel: 'standard' as const,
    },
  },
  memoryBridgeMode: 'manual',
  setMemoryBridgeMode: jest.fn(),
  updateLastAiSession: jest.fn(),
  updateProject: jest.fn(),
};

jest.mock('../store/projectStore', () => ({
  useProjectStore: (selector: (state: typeof mockProjectStoreState) => unknown) =>
    selector(mockProjectStoreState),
}));

jest.mock('../hooks/useActiveProject', () => ({
  useActiveProject: () => mockProject,
}));

jest.mock('../hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ markdown: 'RECENT ACTIVITY BLOCK' }),
}));

jest.mock('../services/personalMemoryVaultStorage', () => ({
  loadPersonalMemoryVault: () => ({
    frontalLobeProfile: {
      defaultAnswerStyle: 'balanced_builder',
      challengeLevel: 'balanced',
      codeReviewStrictness: 'normal',
      explanationDepth: 'explain_why',
      tone: 'balanced',
      codingConfidence: 'can_edit_with_exact_instructions',
      codeInstructionStyle: 'exact_file_and_patch',
      debuggingSupport: 'plain_english_error',
      preferredPace: 'slow_guided',
      mode: 'default_on',
      customRules: [],
    },
  }),
}));

jest.mock('../utils/exportFormatters', () => ({
  formatForPlatform: jest.fn(() => 'EXACT_EXPORT_TEXT'),
  formatForClaudeWithManifest: jest.fn(() => 'EXACT_DEEP_STATE_EXPORT'),
  setScannerLevel: jest.fn(),
}));

jest.mock('../utils/platformConfig', () => ({
  buildContinuityPreamble: jest.fn(() => 'PREAMBLE\n'),
}));

jest.mock('../services/tauriActions', () => ({
  copyExportToClipboard: jest.fn(async () => undefined),
  generateStateManifest: jest.fn(async () => ({
    text: 'manifest text',
    digest: 'sha256:test',
  })),
  getFilesChangedSince: jest.fn(async () => []),
}));

jest.mock('../components/Workspace/ContextPassportModal', () => ({
  ContextPassportModal: () => null,
}));

describe('ExportButtons export preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function openPreview() {
    render(<ExportButtons />);

    fireEvent.click(screen.getByRole('button', { name: /inspect export/i }));

    return screen.findByRole('dialog', { name: /inspect export/i });
  }

  it('opens the export preview', async () => {
    const dialog = await openPreview();

    expect(screen.getByText(/Review the exact handoff/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Claude')).toBeInTheDocument();
  });

  it('preview contains the exact export text', async () => {
    await openPreview();

    const preview = screen.getByLabelText('Export preview text') as HTMLTextAreaElement;
    expect(preview.value).toBe('PREAMBLE\nEXACT_EXPORT_TEXT');
  });

  it('shows Frontal Lobe status', async () => {
    const dialog = await openPreview();

    expect(within(dialog).getByText(/AI Working Style: Included automatically/))
      .toBeInTheDocument();
  });

  it('copy button writes the preview export to clipboard', async () => {
    await openPreview();

    fireEvent.click(screen.getByRole('button', { name: /copy export/i }));

    await waitFor(() => {
      expect(copyExportToClipboard).toHaveBeenCalledWith(
        'PREAMBLE\nEXACT_EXPORT_TEXT',
        'claude',
      );
    });
  });

  it('shows the private vault warning', async () => {
    await openPreview();

    expect(screen.getByText(/Private vault contents are excluded unless explicitly included/i))
      .toBeInTheDocument();
  });
});
