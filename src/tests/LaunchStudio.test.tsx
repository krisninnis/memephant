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
};

let activeProject: ProjectMemory | undefined = mockProject;

jest.mock('../hooks/useActiveProject', () => ({
  useActiveProject: () => activeProject,
}));

jest.mock('../services/tauriActions', () => ({
  copyExportToClipboard: jest.fn(async () => undefined),
}));

describe('LaunchStudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeProject = mockProject;
  });

  it('renders a dedicated launch and distribution surface', () => {
    render(<LaunchStudio />);

    expect(screen.getByRole('heading', { name: 'Launch Studio' })).toBeInTheDocument();
    expect(screen.getByText(
      'Turn this project context into launch posts, build updates, demo scripts, and feedback requests.',
    )).toBeInTheDocument();
    expect(screen.getByText('Project: Launch Studio Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Launch Passport/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Build Update/i })).toBeInTheDocument();
  });

  it('opens and copies a Launch Passport generated from project context', async () => {
    render(<LaunchStudio />);

    fireEvent.click(screen.getByRole('button', { name: /generate launch passport/i }));

    const dialog = screen.getByRole('dialog', { name: 'Launch Passport' });
    expect(within(dialog).getByText('X/Twitter launch post')).toBeInTheDocument();
    const launchText = within(dialog).getByLabelText('Launch Passport export text') as HTMLTextAreaElement;
    expect(launchText.value).toContain('Launch Studio Project');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy Launch Passport' }));

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

  it('shows an empty state when no project is active', () => {
    activeProject = undefined;

    render(<LaunchStudio />);

    expect(screen.getByRole('heading', { name: 'Open a project first' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate Launch Passport/i }))
      .not.toBeInTheDocument();
  });
});
