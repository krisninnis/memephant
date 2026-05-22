import { render, screen } from '@testing-library/react';
import { ContextPassportModal } from '../components/Workspace/ContextPassportModal';
import type { ProjectMemory } from '../types/memphant-types';

const project: ProjectMemory = {
  id: 'memory-trail-project',
  name: 'Memory Trail Project',
  summary: 'A project continuity test.',
  currentState: 'Ready to hand off.',
  goals: ['Keep naming clear'],
  rules: ['Do not rename Passport identity'],
  decisions: [],
  nextSteps: ['Validate UI labels'],
  openQuestions: [],
  importantAssets: [],
  changelog: [],
  checkpoints: [],
  platformState: {},
  schema_version: '1.2.0',
};

describe('ContextPassportModal visible Memory Trail naming', () => {
  it('shows Memory Trail labels without changing the internal component name', () => {
    render(<ContextPassportModal project={project} onClose={jest.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Memory Trail' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Memory Trail' })).toBeInTheDocument();
    expect(screen.getByText(
      'Memory Trail helps another AI continue your project from where you left off.',
    )).toBeInTheDocument();
    expect(screen.getByLabelText('Memory Trail for ChatGPT')).toBeInTheDocument();
    expect(screen.queryByText('Context Passport')).not.toBeInTheDocument();
  });
});
