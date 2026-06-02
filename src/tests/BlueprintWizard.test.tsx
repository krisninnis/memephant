import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BlueprintWizard from '../components/Blueprint/BlueprintWizard';
import { saveToDisk } from '../services/tauriActions';
import { useProjectStore } from '../store/projectStore';
import type { ProjectMemory } from '../types/memphant-types';

jest.mock('../services/tauriActions', () => ({
  saveToDisk: jest.fn().mockResolvedValue(undefined),
}));

describe('BlueprintWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProjectStore.setState({
      projects: [],
      activeProjectId: null,
      currentView: 'projects',
      toastMessage: null,
    });
  });

  it('creates and saves a project from blueprint answers', async () => {
    const onClose = jest.fn();
    render(<BlueprintWizard onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'Context Client Hub' },
    });
    fireEvent.change(screen.getByLabelText('One-sentence idea'), {
      target: { value: 'A local-first workspace for carrying client project context between AI tools.' },
    });
    fireEvent.change(screen.getByLabelText('Problem being solved'), {
      target: { value: 'Freelancers have to re-explain the same client project whenever they switch AI tools.' },
    });
    fireEvent.change(screen.getByLabelText('Target audience'), {
      target: { value: 'Freelancers managing several client projects' },
    });
    fireEvent.change(screen.getByLabelText('Desired outcome'), {
      target: { value: 'continue client work instantly without rebuilding context' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByLabelText('Project type'), {
      target: { value: 'desktop-app' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByLabelText('Build approach'), {
      target: { value: 'production-grade' },
    });
    fireEvent.change(screen.getByLabelText('Preferred stack'), {
      target: { value: 'Tauri, React, SQLite' },
    });
    fireEvent.change(screen.getByLabelText('Local-first?'), {
      target: { value: 'yes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByLabelText('Primary AI'), {
      target: { value: 'codex' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Blueprint Preview' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => expect(saveToDisk).toHaveBeenCalledTimes(1));

    const project = (saveToDisk as jest.Mock).mock.calls[0][0] as ProjectMemory;
    expect(project.name).toBe('Context Client Hub');
    expect(project.projectBlueprint?.input.primaryAI).toBe('codex');
    expect(project.projectCharter).toContain('# Project Blueprint: Context Client Hub');
    expect(useProjectStore.getState().projects).toEqual([
      expect.objectContaining({ id: project.id, projectBlueprint: project.projectBlueprint }),
    ]);
    expect(useProjectStore.getState().activeProjectId).toBe(project.id);
    expect(onClose).toHaveBeenCalled();
  });
});
