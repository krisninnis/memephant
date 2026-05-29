import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import LaunchStudio from '../components/LaunchStudio/LaunchStudio';
import type { ProjectMemory } from '../types/memphant-types';
import { copyExportToClipboard } from '../services/tauriActions';

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
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('renders a dedicated launch and distribution surface', () => {
    render(<LaunchStudio />);

    expect(screen.getByRole('heading', { name: 'Launch Studio' })).toBeInTheDocument();
    expect(screen.getByText(
      'Turn this project context into launch posts, build updates, demo scripts, and feedback requests.',
    )).toBeInTheDocument();
    expect(screen.getByText('Project: Launch Studio Project')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Improve clarity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Generate content' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Share safely' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check Project Clarity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Launch Kit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Build Update/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Daily Content Pack/i })).toBeInTheDocument();
    expect(screen.getByText('Social Bridge')).toBeInTheDocument();
    expect(screen.getByText(/Share buttons appear beside each generated section/i)).toBeInTheDocument();
    expect(screen.getByText('Generate content first, then choose the section you want to share.')).toBeInTheDocument();
    expect(screen.getByText('Preview before posting. Memephant never posts automatically.')).toBeInTheDocument();
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

  it('opens and copies a Launch Kit generated from project context', async () => {
    render(<LaunchStudio />);

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

    fireEvent.click(screen.getByRole('button', { name: /generate daily content pack/i }));

    const dialog = screen.getByRole('dialog', { name: 'Daily Content Pack' });
    expect(within(dialog).getByText('X post')).toBeInTheDocument();
    expect(within(dialog).getByText('Problem/solution post')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Preview before posting. Memephant never posts automatically.')[0]).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button', { name: 'Open in X' })[0]).toBeInTheDocument();
    const packText = within(dialog).getByLabelText('Daily Content Pack export text') as HTMLTextAreaElement;
    expect(packText.value).toContain('Launch Studio Project');

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Open in X' })[0]);
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://twitter.com/intent/tweet?text='),
      '_blank',
      'noopener,noreferrer',
    );

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

    fireEvent.click(screen.getByRole('button', { name: /generate daily content pack/i }));

    const dialog = screen.getByRole('dialog', { name: 'Daily Content Pack' });
    expect(within(dialog).getAllByText('Add what changed recently to generate better posts.')[0])
      .toBeInTheDocument();

    const xButtons = within(dialog).getAllByRole('button', { name: 'Open in X' });
    expect(xButtons[0]).toBeDisabled();

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
    expect(screen.queryByRole('button', { name: /Generate Daily Content Pack/i }))
      .not.toBeInTheDocument();
  });
});
