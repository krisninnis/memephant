import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('keeps advanced writing options collapsed and opt-in', () => {
    render(<ContextPassportModal project={{
      ...project,
      summary: 'A local-first export flow\u2014with predictable text.',
    }} onClose={jest.fn()} />);

    const options = screen.getByRole('button', { name: /Advanced writing options Show options/i });
    expect(options).toHaveAttribute('aria-expanded', 'false');
    expect(options).toHaveTextContent('Show options ▾');

    fireEvent.click(options);

    expect(options).toHaveAttribute('aria-expanded', 'true');
    expect(options).toHaveTextContent('Hide options ▴');
    expect(screen.getByLabelText('Avoid em dashes')).not.toBeChecked();
    expect(screen.getByLabelText('Simplify polished wording')).not.toBeChecked();
    expect(screen.getByText(
      'Remove or simplify common over-polished AI wording in copied passports.',
    )).toBeInTheDocument();

    const preview = screen.getByLabelText('Memory Trail for ChatGPT') as HTMLTextAreaElement;
    expect(preview.value).toContain('flow\u2014with');

    fireEvent.click(screen.getByLabelText('Avoid em dashes'));

    expect(screen.getByLabelText('Avoid em dashes')).toBeChecked();
    expect(preview.value).toContain('flow - with');
    expect(preview.value).not.toContain('flow\u2014with');
  });

  it('copies transformed passport text when avoid em dashes is enabled', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<ContextPassportModal project={{
      ...project,
      summary: 'A local-first export flow\u2014with predictable text.',
    }} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Advanced writing options Show options/i }));
    fireEvent.click(screen.getByLabelText('Avoid em dashes'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy for ChatGPT' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('flow - with');
    expect(copied).not.toContain('flow\u2014with');
  });

  it('applies reduced AI phrases to the passport preview only after opt-in', () => {
    render(<ContextPassportModal project={{
      ...project,
      summary: 'It is important to note that this robust flow can streamline handoff.',
    }} onClose={jest.fn()} />);

    const preview = screen.getByLabelText('Memory Trail for ChatGPT') as HTMLTextAreaElement;
    expect(preview.value).toContain('It is important to note that this robust flow can streamline handoff.');

    fireEvent.click(screen.getByRole('button', { name: /Advanced writing options Show options/i }));
    fireEvent.click(screen.getByLabelText('Simplify polished wording'));

    expect(screen.getByLabelText('Simplify polished wording')).toBeChecked();
    expect(preview.value).toContain('this solid flow can simplify handoff.');
    expect(preview.value).not.toContain('It is important to note that');
    expect(preview.value).not.toContain('robust flow');
  });
});
