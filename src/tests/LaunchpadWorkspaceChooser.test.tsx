import { fireEvent, render, screen, within } from '@testing-library/react';
import LaunchpadWizard from '../components/Launchpad/LaunchpadWizard';

jest.mock('../store/projectStore', () => ({
  useProjectStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addProject: jest.fn(),
      setActiveProject: jest.fn(),
      setCurrentView: jest.fn(),
      showToast: jest.fn(),
    }),
}));

jest.mock('../services/tauriActions', () => ({
  createTemplateProjectFolder: jest.fn(),
  openCreatedProjectFolder: jest.fn(),
  saveToDisk: jest.fn(),
}));

describe('Launchpad workspace chooser', () => {
  const renderWizard = () => {
    const callbacks = {
      onClose: jest.fn(),
      onScanExisting: jest.fn(),
      onCreateBlankMemory: jest.fn(),
      onOpenJobHunt: jest.fn(),
    };

    render(<LaunchpadWizard {...callbacks} />);
    return callbacks;
  };

  it('renders all four workspace types before creation options', () => {
    renderWizard();

    expect(screen.getByRole('heading', { name: 'What are you working on?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Software Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Game Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Job Hunt/i })).toBeInTheDocument();
    expect(screen.getByText(/Context Passport \/ Summary \/ Goals/i)).toBeInTheDocument();
    expect(screen.getByText(/Linked Folder \/ Game Platform \/ Game Systems/i)).toBeInTheDocument();
  });

  it('choosing Game routes blank project creation as a game workspace', () => {
    const callbacks = renderWizard();

    fireEvent.click(screen.getByRole('button', { name: /Game Project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Game Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Scan existing project/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start from template/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Blank memory project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(callbacks.onCreateBlankMemory).toHaveBeenCalledWith('game');
  });

  it('choosing Software keeps folder and developer tools available', () => {
    const callbacks = renderWizard();

    fireEvent.click(screen.getByRole('button', { name: /Software Project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const summary = screen.getByText('Software Project').closest('.launchpad-workspace-summary');
    expect(summary).toBeTruthy();
    expect(within(summary as HTMLElement).getByText(/Linked Folder \/ Scan Results/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Scan existing project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(callbacks.onScanExisting).toHaveBeenCalledWith('software');
  });

  it('choosing Job Hunt opens the Job Hunt Passport workspace', () => {
    const callbacks = renderWizard();

    fireEvent.click(screen.getByRole('button', { name: /Job Hunt/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(callbacks.onOpenJobHunt).toHaveBeenCalledTimes(1);
    expect(callbacks.onCreateBlankMemory).not.toHaveBeenCalled();
    expect(callbacks.onScanExisting).not.toHaveBeenCalled();
  });
});
