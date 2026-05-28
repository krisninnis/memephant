import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ExportButtons } from '../components/Workspace/ExportButtons';
import type { ProjectMemory } from '../types/memphant-types';
import { DEFAULT_SETTINGS } from '../types/memphant-types';
import { copyExportToClipboard } from '../services/tauriActions';
import { formatForPlatform } from '../utils/exportFormatters';
import { verifyPassportPasscode } from '../services/passportLockStorage';

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

const mockPassportState = {
  passport: {
    id: 'MPH-1111-2222-3333',
    fingerprint: '1111222233334444',
    profile: {
      communicationStyle: 'structured' as const,
      tone: 'friendly' as const,
      focusArea: 'app' as const,
    },
    createdAt: '2026-05-21T10:00:00.000Z',
    schemaVersion: '1.0' as const,
  },
};

let mockPassportLockEnabled = false;

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
      languagePreference: 'british_english',
      codingConfidence: 'can_edit_with_exact_instructions',
      codeInstructionStyle: 'exact_file_and_patch',
      debuggingSupport: 'plain_english_error',
      preferredPace: 'slow_guided',
      mode: 'default_on',
      customRules: [],
    },
  }),
}));

jest.mock('../features/passport/usePassportStore', () => ({
  usePassportStore: (selector: (state: typeof mockPassportState) => unknown) =>
    selector(mockPassportState),
}));

jest.mock('../services/passportLockStorage', () => ({
  isPassportLockEnabled: () => mockPassportLockEnabled,
  verifyPassportPasscode: jest.fn(async () => true),
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
    mockProjectStoreState.targetPlatform = 'claude';
    delete mockProject.workflowMode;
    mockPassportLockEnabled = false;
    (formatForPlatform as jest.Mock).mockReturnValue('EXACT_EXPORT_TEXT');
  });

  async function openPreview() {
    render(<ExportButtons />);

    fireEvent.click(screen.getByRole('button', { name: /inspect export/i }));

    return screen.findByRole('dialog', { name: /inspect export/i });
  }

  it('opens the export preview', async () => {
    const dialog = await openPreview();

    expect(screen.getByText(/Nothing leaves your device until you choose Copy export/i))
      .toBeInTheDocument();
    expect(within(dialog).getByText('Claude')).toBeInTheDocument();
  });

  it('explains Passport Attachment near the export controls', () => {
    render(<ExportButtons />);

    expect(screen.getByText(
      'Attach your AI Passport to help the next AI understand how you like to work.',
    )).toBeInTheDocument();
  });

  it('labels the project continuity export as Context Passport', () => {
    render(<ExportButtons />);

    expect(screen.getByRole('button', { name: /generate context passport/i }))
      .toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate memory trail/i }))
      .not.toBeInTheDocument();
  });

  it('explains the next cross-AI handoff step near export controls', () => {
    render(<ExportButtons />);

    expect(screen.getByText('Next step')).toBeInTheDocument();
    expect(screen.getByText(
      /Generate a Context Passport, inspect it, then paste it into ChatGPT, Claude,/,
    )).toBeInTheDocument();
  });

  it('stores the selected AI Workflow Mode on the project', () => {
    render(<ExportButtons />);

    fireEvent.click(screen.getByRole('button', { name: /Build/i }));

    expect(mockProjectStoreState.updateProject).toHaveBeenCalledWith(
      'export-preview-project',
      { workflowMode: 'build' },
    );
  });

  it('shows the active AI Workflow Mode and lets users clear it', () => {
    mockProject.workflowMode = 'debug';

    render(<ExportButtons />);

    expect(screen.getByText('Debug Mode')).toBeInTheDocument();
    expect(screen.getByText(/Prioritise evidence, reproduction steps/i)).toBeInTheDocument();

    const workflowModes = screen.getByLabelText('AI Workflow Mode');
    fireEvent.click(within(workflowModes).getByRole('button', { name: /Debug/i }));

    expect(mockProjectStoreState.updateProject).toHaveBeenCalledWith(
      'export-preview-project',
      { workflowMode: undefined },
    );
  });

  it('opens and copies a Launch Passport generated from project context', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<ExportButtons />);

    fireEvent.click(screen.getByRole('button', { name: /generate launch passport/i }));

    const dialog = screen.getByRole('dialog', { name: 'Launch Passport' });
    expect(within(dialog).getByText(
      'Reusable launch assets generated from this project context. Review before posting.',
    )).toBeInTheDocument();
    expect(within(dialog).getByText('X/Twitter launch post')).toBeInTheDocument();
    const launchText = within(dialog).getByLabelText('Launch Passport export text') as HTMLTextAreaElement;
    expect(launchText.value).toContain('Export Preview Project');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy Launch Passport' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Launch Passport'));
    });
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Copied Launch Passport' }))
        .toBeInTheDocument();
    });
  });

  it('preview contains the exact export text', async () => {
    await openPreview();

    const preview = screen.getByLabelText('Export preview text') as HTMLTextAreaElement;
    expect(preview.value).toBe('PREAMBLE\nEXACT_EXPORT_TEXT');
  });

  it('uses a clear toggle for copy options', () => {
    render(<ExportButtons />);

    const copyOptions = screen.getByRole('button', { name: 'Show copy options' });
    expect(copyOptions).toHaveAttribute('aria-expanded', 'false');
    expect(copyOptions).toHaveAttribute('aria-controls', 'copy-options-menu');
    expect(copyOptions).toHaveTextContent('Show options ▾');

    fireEvent.click(copyOptions);

    expect(copyOptions).toHaveAttribute('aria-expanded', 'true');
    expect(copyOptions).toHaveAccessibleName('Hide copy options');
    expect(copyOptions).toHaveTextContent('Hide options ▴');
    expect(screen.getByRole('menu', { name: 'Copy options' })).toBeInTheDocument();
  });

  it('applies Advanced writing options in Inspect export before copying', async () => {
    (formatForPlatform as jest.Mock).mockReturnValue(
      'It is important to note that robust handoffs\u2014moving forward\u2014streamline work.',
    );

    await openPreview();

    const options = screen.getByRole('button', { name: /Advanced writing options Show options/i });
    expect(options).toHaveAttribute('aria-expanded', 'false');
    expect(options).toHaveTextContent('Show options ▾');

    fireEvent.click(options);
    expect(options).toHaveAttribute('aria-expanded', 'true');
    expect(options).toHaveTextContent('Hide options ▴');
    expect(screen.getByLabelText('Avoid em dashes')).not.toBeChecked();
    expect(screen.getByLabelText('Simplify polished wording')).not.toBeChecked();

    fireEvent.click(screen.getByLabelText('Avoid em dashes'));
    fireEvent.click(screen.getByLabelText('Simplify polished wording'));

    const preview = screen.getByLabelText('Export preview text') as HTMLTextAreaElement;
    expect(preview.value).toContain('solid handoffs - next - simplify work.');
    expect(preview.value).not.toContain('It is important to note that');

    fireEvent.click(screen.getByRole('button', { name: /copy export/i }));

    await waitFor(() => {
      expect(copyExportToClipboard).toHaveBeenCalledWith(
        expect.stringContaining('solid handoffs - next - simplify work.'),
        'claude',
      );
    });
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

  it('shows post-copy guidance after a successful export copy', async () => {
    await openPreview();

    fireEvent.click(screen.getByRole('button', { name: /copy export/i }));

    await waitFor(() => {
      expect(screen.getByText('Copied successfully.')).toBeInTheDocument();
    });
    expect(screen.getByText(
      /Paste this into ChatGPT, Claude, Gemini, Cursor, Grok, or another AI/i,
    )).toBeInTheDocument();
    expect(screen.getByText(
      'Continue this project from the attached Context Passport.',
    )).toBeInTheDocument();
  });

  it('shows the private vault warning', async () => {
    await openPreview();

    expect(screen.getByText(/Private vault contents are excluded unless explicitly included/i))
      .toBeInTheDocument();
  });

  it('shows Passport Attachment as excluded by default with an exact preview', async () => {
    const dialog = await openPreview();

    expect(within(dialog).getByRole('heading', { name: 'AI Passport' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('Excluded')).toHaveLength(2);
    expect(within(dialog).getByText(
      'Your project context will be copied without your AI working identity.',
    )).toBeInTheDocument();
    expect(within(dialog).getByText('Preview what will be shared')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Attach Passport')).toHaveLength(2);
    expect(within(dialog).getByText('Copy handoff')).toBeInTheDocument();

    expect(screen.queryByLabelText('Passport Attachment preview text')).not.toBeInTheDocument();
    const passportPreviewToggle = screen.getByRole('button', { name: 'Show Passport ▾' });
    expect(passportPreviewToggle).toHaveAttribute('aria-expanded', 'false');
    expect(passportPreviewToggle).toHaveAttribute('aria-controls', 'passport-attachment-preview');

    fireEvent.click(passportPreviewToggle);

    expect(passportPreviewToggle).toHaveAttribute('aria-expanded', 'true');
    expect(passportPreviewToggle).toHaveTextContent('Hide Passport ▴');

    const passportPreview = screen.getByLabelText(
      'Passport Attachment preview text',
    ) as HTMLTextAreaElement;
    expect(passportPreview.value).toContain('# AI Passport');
    expect(passportPreview.value).toContain('- Tone: Friendly');
    expect(passportPreview.value).toContain('- Style: Structured');
    expect(passportPreview.value).toContain('- Language: British English');
    expect(passportPreview.value).toContain('Integrity fingerprint: MPH-1111-2222-3333');

    const preview = screen.getByLabelText('Export preview text') as HTMLTextAreaElement;
    expect(preview.value).toBe('PREAMBLE\nEXACT_EXPORT_TEXT');
  });

  it('appends Passport Attachment only after explicit user toggle', async () => {
    await openPreview();

    fireEvent.click(screen.getByRole('button', { name: 'Attach Passport' }));

    const preview = screen.getByLabelText('Export preview text') as HTMLTextAreaElement;
    expect(preview.value).toContain('PREAMBLE\nEXACT_EXPORT_TEXT');
    expect(preview.value).toContain('# AI Passport');
    expect(screen.getAllByText('Included')).toHaveLength(2);
    expect(screen.getByText('Your AI working identity will be included in this handoff.'))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copy export/i }));

    await waitFor(() => {
      expect(copyExportToClipboard).toHaveBeenCalledWith(
        expect.stringContaining('# AI Passport'),
        'claude',
      );
    });
  });

  it('shows locked Passport Attachment state and requires unlock before attaching', async () => {
    mockPassportLockEnabled = true;

    await openPreview();

    expect(screen.getAllByText('Locked')).toHaveLength(2);
    expect(screen.getByText('Unlock Passport to attach it.')).toBeInTheDocument();
    expect(screen.getByLabelText('Include in this export'))
      .toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attach Passport' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Unlock Passport to attach'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    await waitFor(() => {
      expect(verifyPassportPasscode).toHaveBeenCalledWith('123456');
    });

    fireEvent.click(screen.getByLabelText('Include in this export'));
    const preview = screen.getByLabelText('Export preview text') as HTMLTextAreaElement;
    expect(preview.value).toContain('# AI Passport');
  });

  it('uses Quick Start mode by default for ChatGPT exports', async () => {
    mockProjectStoreState.targetPlatform = 'chatgpt';

    await openPreview();

    expect(formatForPlatform).toHaveBeenCalledWith(
      mockProject,
      'chatgpt',
      'Keep going',
      'quick',
      expect.objectContaining({ id: 'chatgpt' }),
      'RECENT ACTIVITY BLOCK',
      expect.any(String),
    );
  });

  it('shows the Fresh Chat Optimized badge and token estimate for Quick Start exports', async () => {
    mockProjectStoreState.targetPlatform = 'chatgpt';

    await openPreview();

    expect(screen.getByText('Fresh Chat Optimized')).toBeInTheDocument();
    expect(screen.getByText(/~\d+ tokens/)).toBeInTheDocument();
  });

  it('shows a compressed copy option for risky large ChatGPT exports', async () => {
    mockProjectStoreState.targetPlatform = 'chatgpt';
    (formatForPlatform as jest.Mock).mockReturnValue(`LARGE${'\n\n\n\n'.repeat(12000)}END`);

    await openPreview();

    expect(screen.getByText(/Export health: Needs a look/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /copy compressed version/i }));

    await waitFor(() => {
      expect(copyExportToClipboard).toHaveBeenCalledWith(
        expect.not.stringContaining('\n\n\n\n'),
        'chatgpt',
      );
    });
  });
});
