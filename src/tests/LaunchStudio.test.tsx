import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LaunchStudio from '../components/LaunchStudio/LaunchStudio';
import type { ProjectMemory } from '../types/memphant-types';
import { copyExportToClipboard } from '../services/tauriActions';
import { useProjectStore } from '../store/projectStore';

const mockProject: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'launch-studio-project',
  name: 'Launch Studio Project',
  summary: 'A focused project for launch drafts.',
  goals: ['Explain project context clearly'],
  rules: ['Keep launch copy honest'],
  decisions: [],
  currentState: 'Launch Studio is ready to test.',
  nextSteps: ['Share a demo clip'],
  openQuestions: ['Does the launch copy feel clear?'],
  importantAssets: [],
  changelog: [],
  checkpoints: [],
  platformState: {},
  workflowMode: 'launch',
};

let activeProject: ProjectMemory | undefined = mockProject;
let updateProjectMock: jest.Mock;
let showToastMock: jest.Mock;

jest.mock('../hooks/useActiveProject', () => ({
  useActiveProject: () => activeProject,
}));

jest.mock('../services/tauriActions', () => ({
  copyExportToClipboard: jest.fn(async () => undefined),
}));

describe('LaunchStudio', () => {
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    activeProject = mockProject;
    updateProjectMock = jest.fn();
    showToastMock = jest.fn();
    useProjectStore.setState({
      updateProject: updateProjectMock,
      showToast: showToastMock,
    });
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('renders a dedicated launch and distribution surface', () => {
    render(<LaunchStudio />);

    expect(screen.getByRole('heading', { name: 'Launch Studio' })).toBeInTheDocument();
    expect(screen.getByText(
      /Turn project context into clear public communication/i,
    )).toBeInTheDocument();
    expect(screen.getByText('Project: Launch Studio Project')).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Launch Studio sections' });
    expect(within(navigation).getByRole('button', { name: /Project Clarity/i })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: /Launch Kit/i })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: /Post Today/i })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: /Share/i })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Project Clarity' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Is this project clear enough to explain publicly?').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Check Project Clarity/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate Launch Kit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate Build Update/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Phase 1')).not.toBeInTheDocument();
  });

  it('opens Project Clarity with score, weak areas, and suggestions', () => {
    render(<LaunchStudio />);

    fireEvent.click(screen.getByRole('button', { name: /check project clarity/i }));

    const dialog = screen.getByRole('dialog', { name: 'Project Clarity' });
    expect(within(dialog).getByLabelText('Overall readiness score')).toHaveTextContent('/100');
    expect(within(dialog).getByText('Strengths')).toBeInTheDocument();
    expect(within(dialog).getByText('Weak areas')).toBeInTheDocument();
    expect(within(dialog).getByText('Suggested improvements')).toBeInTheDocument();
    expect(within(dialog).getByText('Missing basics')).toBeInTheDocument();
    expect(within(dialog).getByText('Improve Launch Content')).toBeInTheDocument();
  });

  it('keeps sharing as guidance rather than a standalone social tool', () => {
    render(<LaunchStudio />);

    fireEvent.click(screen.getByRole('button', { name: /Share/i }));

    expect(screen.getByRole('heading', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByText(/Open generated content in X, LinkedIn, Reddit, or Facebook/i))
      .toBeInTheDocument();
    expect(screen.getByText('Share buttons stay beside generated sections, not on this page.'))
      .toBeInTheDocument();
    expect(screen.queryByText('Social Bridge')).not.toBeInTheDocument();
  });

  it('offers a plain-English positioning helper with example template answers', () => {
    render(<LaunchStudio />);

    fireEvent.click(screen.getByRole('button', { name: /check project clarity/i }));

    const dialog = screen.getByRole('dialog', { name: 'Project Clarity' });
    expect(within(dialog).getByText('Who is this for?')).toBeInTheDocument();
    expect(within(dialog).getByText('Example: Freelancers managing client work.')).toBeInTheDocument();
    expect(within(dialog).getByText('What frustrating problem does it solve?')).toBeInTheDocument();
    expect(within(dialog).getByText('Example: Rebuilding project context every time I switch AI tools.')).toBeInTheDocument();
    expect(within(dialog).getByText('What happens after using it?')).toBeInTheDocument();
    expect(within(dialog).getByText('Why is it different?')).toBeInTheDocument();
    expect(within(dialog).getByText(/This helps generated copy explain what gets better/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Use Example Template' }));

    const fields = within(dialog).getAllByRole('textbox') as HTMLTextAreaElement[];
    expect(fields.map((field) => field.value)).toEqual([
      'Freelancers managing client work.',
      'Rebuilding project context every time I switch AI tools.',
      'Continue work instantly without re-explaining everything.',
      'Local-first and works across multiple AI tools.',
    ]);
  });

  it('saves local what-shipped-today progress for Launch Studio generators', () => {
    render(<LaunchStudio />);

    const input = screen.getByLabelText('What Did You Ship Today?');
    const shippedToday = [
      'Added Launch Studio tabs.',
      'Improved modal scrolling.',
      'Added Social Bridge sharing actions.',
      'Polished app-wide spacing.',
    ].join('\n');

    expect(screen.getByText('Tell Memephant what changed today so it can generate better launch content.'))
      .toBeInTheDocument();
    expect(screen.getByText('These updates will be used by:')).toBeInTheDocument();
    expect(screen.getByText('Future launch content')).toBeInTheDocument();

    fireEvent.change(input, {
      target: {
        value: shippedToday,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Progress' }));

    expect(updateProjectMock).toHaveBeenCalledWith(
      'launch-studio-project',
      expect.objectContaining({
        recentProgressNote: shippedToday,
        changelog: expect.arrayContaining([
          expect.objectContaining({
            field: 'recentProgressNote',
            action: 'added',
            source: 'user',
            summary: 'Added Launch Studio tabs.',
          }),
          expect.objectContaining({
            field: 'recentProgressNote',
            action: 'added',
            source: 'user',
            summary: 'Improved modal scrolling.',
          }),
        ]),
      }),
    );
    expect(showToastMock).toHaveBeenCalledWith(
      'Progress saved for Launch Studio.',
      'success',
    );
  });

  it('saves a local project reason for Launch Kit founder copy', () => {
    render(<LaunchStudio />);

    const input = screen.getByLabelText('Why does this project exist?');
    const projectReason =
      'I got tired of re-explaining the same project every time I switched between ChatGPT, Claude, Cursor, or Gemini.';

    expect(screen.getByText(/Explain the problem that made you build this/i)).toBeInTheDocument();

    fireEvent.change(input, {
      target: {
        value: projectReason,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save project reason' }));

    expect(updateProjectMock).toHaveBeenCalledWith(
      'launch-studio-project',
      expect.objectContaining({
        projectReason,
        updatedAt: expect.any(String),
      }),
    );
    expect(showToastMock).toHaveBeenCalledWith(
      'Project reason saved for Launch Kit.',
      'success',
    );
  });

  it('opens and copies a Launch Kit generated from project context', async () => {
    render(<LaunchStudio />);

    fireEvent.click(screen.getByRole('button', { name: /Launch Kit/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate launch kit/i }));

    const dialog = screen.getByRole('dialog', { name: 'Launch Kit' });
    expect(within(dialog).getByText('X/Twitter launch post')).toBeInTheDocument();
    const launchText = within(dialog).getByLabelText('Launch Kit export text') as HTMLTextAreaElement;
    expect(launchText.value).toContain('Launch Studio Project');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy Launch Kit' }));

    await waitFor(() => {
      expect(copyExportToClipboard).toHaveBeenCalledWith(
        expect.stringContaining('# Launch Passport'),
        'launch-passport',
      );
    });
  });

  it('opens and copies a Build Update generated from project context', async () => {
    render(<LaunchStudio />);

    fireEvent.click(screen.getByRole('button', { name: /Post Today/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate build update/i }));

    const dialog = screen.getByRole('dialog', { name: 'Build Update' });
    expect(within(dialog).getByText('X/Twitter build update')).toBeInTheDocument();
    const updateText = within(dialog).getByLabelText('Build Update export text') as HTMLTextAreaElement;
    expect(updateText.value).toContain('Launch Studio Project');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy Build Update' }));

    await waitFor(() => {
      expect(copyExportToClipboard).toHaveBeenCalledWith(
        expect.stringContaining('# Build Update'),
        'build-update',
      );
    });
  });

  it('opens and copies a Daily Content Pack generated from project context', async () => {
    render(<LaunchStudio />);

    fireEvent.click(screen.getByRole('button', { name: /Post Today/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate post today/i }));

    const dialog = screen.getByRole('dialog', { name: 'Daily Content Pack' });
    expect(within(dialog).getByText('X post')).toBeInTheDocument();
    expect(within(dialog).getByText('Problem/solution post')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Preview before posting. Memephant never posts automatically.')[0]).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Open in X' })[0]).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Copy' })[0]).toBeInTheDocument();
    const packText = within(dialog).getByLabelText('Daily Content Pack export text') as HTMLTextAreaElement;
    expect(packText.value).toContain('Launch Studio Project');

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Open in X' })[0]);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://twitter.com/intent/tweet?text='),
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Copy' })[0]);

    await waitFor(() => {
      expect(copyExportToClipboard).toHaveBeenCalledWith(
        expect.stringContaining('Launch Studio Project'),
        'social-copy',
      );
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy Daily Content Pack' }));

    await waitFor(() => {
      expect(copyExportToClipboard).toHaveBeenCalledWith(
        expect.stringContaining('# Daily Content Pack'),
        'daily-content-pack',
      );
    });
  });

  it('softens Social Bridge actions when generated daily content has no recent shipped update', () => {
    activeProject = {
      ...mockProject,
      summary: 'Move your project between AI tools without ever rebuilding context.',
      currentState: 'Project updated.',
      inProgress: [],
      changelog: [
        {
          timestamp: '2026-05-29T09:00:00.000Z',
          field: 'session',
          action: 'updated',
          summary: 'Last session summary updated',
        },
      ],
    };

    render(<LaunchStudio />);

    fireEvent.click(screen.getByRole('button', { name: /Post Today/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate post today/i }));

    const dialog = screen.getByRole('dialog', { name: 'Daily Content Pack' });
    expect(within(dialog).getAllByText('Add what changed recently to generate better posts.')[0])
      .toBeInTheDocument();

    const xButtons = within(dialog).getAllByRole('button', { name: 'Open in X' });
    expect(xButtons[0]).toBeDisabled();
    expect(within(dialog).getAllByRole('button', { name: 'Copy' })[0]).toBeDisabled();

    fireEvent.click(xButtons[0]);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('shows an empty state when no project is active', () => {
    activeProject = undefined;

    render(<LaunchStudio />);

    expect(screen.getByRole('heading', { name: 'Open a project first' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Project Clarity/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate Launch Kit/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate Post Today/i }))
      .not.toBeInTheDocument();
  });
});
