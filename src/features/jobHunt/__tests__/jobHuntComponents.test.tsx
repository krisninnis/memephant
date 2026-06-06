import { fireEvent, render, screen, within } from '@testing-library/react';
import { JobHuntProfilePanel } from '../components/JobHuntProfilePanel';
import { JobPromptPanel } from '../components/JobPromptPanel';
import { JobTrackerList } from '../components/JobTrackerList';
import { PasteJobsPanel } from '../components/PasteJobsPanel';
import type { JobHuntProfile, JobItem } from '../types';

const baseProfile: JobHuntProfile = {
  targetRoles: ['Creative technologist'],
  targetLocations: ['Remote UK'],
  preferredRemoteType: 'mostly remote',
  experienceLevel: 'Returning after career break',
  cvSummary: '',
  keySkills: ['React'],
  projects: [],
  constraints: '',
};

const baseJob: JobItem = {
  id: 'job-1',
  title: 'Frontend Developer',
  company: 'Acme',
  remoteType: 'remote',
  fitScore: 'high',
  status: 'not_applied',
  createdAt: '2026-06-05T10:00:00.000Z',
  updatedAt: '2026-06-05T10:00:00.000Z',
};

describe('Job Hunt Passport UI controls', () => {
  it('shows saved custom profile values through Other inputs', () => {
    render(<JobHuntProfilePanel profile={baseProfile} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Target role')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Target role')).toHaveValue('Creative technologist');
    expect(screen.getByLabelText('Preferred remote type')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Preferred remote type')).toHaveValue('mostly remote');
    expect(screen.getByLabelText('Experience level')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Experience level')).toHaveValue('Returning after career break');
  });

  it('quick-adds key skills and disables existing skill chips', () => {
    const onChange = jest.fn();
    render(<JobHuntProfilePanel profile={baseProfile} onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'React' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'TypeScript' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      keySkills: ['React', 'TypeScript'],
    }));
  });

  it('shows useful import feedback for empty pasted text', () => {
    render(<PasteJobsPanel onImport={jest.fn()} lastImportCount={0} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import jobs' }));

    expect(screen.getByText('Paste a job list first.')).toBeInTheDocument();
  });

  it('renders guided job card presets and custom saved values', () => {
    const onStatusChange = jest.fn();
    const onRemoteTypeChange = jest.fn();
    const onFitScoreChange = jest.fn();
    render(
      <JobTrackerList
        jobs={[{
          ...baseJob,
          status: 'maybe later',
          remoteType: 'one day onsite each quarter',
          fitScore: 'portfolio match',
        }]}
        selectedJobId="job-1"
        onSelect={jest.fn()}
        onStatusChange={onStatusChange}
        onRemoteTypeChange={onRemoteTypeChange}
        onFitScoreChange={onFitScoreChange}
        onNotesChange={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Status')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Status')).toHaveValue('maybe later');
    expect(screen.getByLabelText('Remote type')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Remote type')).toHaveValue('one day onsite each quarter');
    expect(screen.getByLabelText('Fit score')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Fit score')).toHaveValue('portfolio match');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'applied' } });
    expect(onStatusChange).toHaveBeenCalledWith('job-1', 'applied');
  });

  it('disables prompt buttons and shows guidance when no job is selected', () => {
    render(<JobPromptPanel profile={baseProfile} job={null} />);

    expect(screen.getByDisplayValue('Import or select a job first to generate prompts.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeDisabled();

    const promptTabs = within(screen.getByRole('tablist', { name: 'Job prompt type' })).getAllByRole('button');
    expect(promptTabs.every((button) => button.hasAttribute('disabled'))).toBe(true);
  });
});
