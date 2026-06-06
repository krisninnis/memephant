import type { JobApplicationStatus, JobFitScore, JobItem, JobRemoteType } from '../types';

const OTHER_VALUE = '__other__';

const STATUS_OPTIONS: Array<{ value: JobApplicationStatus; label: string }> = [
  { value: 'not_applied', label: 'Saved' },
  { value: 'shortlisted', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interviewing' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'offer', label: 'Offer' },
  { value: 'not_suitable', label: 'Not suitable' },
];

const REMOTE_OPTIONS: Array<{ value: JobRemoteType; label: string }> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'remote', label: 'Fully remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
  { value: 'remote_uk_only', label: 'Remote UK only' },
];

const FIT_OPTIONS: Array<{ value: JobFitScore; label: string }> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'high', label: 'Strong fit' },
  { value: 'medium', label: 'Possible fit' },
  { value: 'stretch', label: 'Stretch role' },
  { value: 'not_suitable', label: 'Not suitable' },
];

type Props = {
  jobs: JobItem[];
  selectedJobId: string | null;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: JobApplicationStatus) => void;
  onRemoteTypeChange: (id: string, remoteType: JobRemoteType) => void;
  onFitScoreChange: (id: string, fitScore: JobFitScore) => void;
  onNotesChange: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
};

function selectedValue(value: string | undefined, options: Array<{ value: string; label: string }>): string {
  const raw = value ?? '';
  if (!raw) return '';
  return options.some((option) => option.value === raw) ? raw : OTHER_VALUE;
}

function GuidedJobSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const selectValue = selectedValue(value, options);
  return (
    <div className="job-hunt-guided-field">
      <label>
        {label}
        <select
          className="field-input"
          value={selectValue}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === OTHER_VALUE ? '' : next);
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
          <option value={OTHER_VALUE}>Other</option>
        </select>
      </label>
      {selectValue === OTHER_VALUE && (
        <label>
          Custom {label}
          <input
            className="field-input"
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      )}
    </div>
  );
}

export function JobTrackerList({
  jobs,
  selectedJobId,
  onSelect,
  onStatusChange,
  onRemoteTypeChange,
  onFitScoreChange,
  onNotesChange,
  onDelete,
}: Props) {
  return (
    <section className="job-hunt-card job-hunt-card--tracker" aria-label="Job Tracker">
      <div className="job-hunt-card__header">
        <div>
          <div className="field-label">Job Tracker</div>
          <h2>{jobs.length} {jobs.length === 1 ? 'role' : 'roles'}</h2>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="job-hunt-empty">
          <strong>No jobs imported yet.</strong>
          <p>Paste a ChatGPT-generated list above to create local job cards.</p>
        </div>
      ) : (
        <div className="job-hunt-job-list">
          {jobs.map((job) => (
            <article
              key={job.id}
              className={`job-hunt-job-card${selectedJobId === job.id ? ' job-hunt-job-card--active' : ''}`}
            >
              <button
                type="button"
                className="job-hunt-job-card__select"
                onClick={() => onSelect(job.id)}
              >
                <strong>{job.title || 'Untitled role'}</strong>
                <span>{job.company || 'Company not detected'}</span>
              </button>

              <div className="job-hunt-job-card__meta">
                {job.location && <span>{job.location}</span>}
                <span>{job.remoteType ?? 'unknown'}</span>
                {job.salary && <span>{job.salary}</span>}
                <span>Fit: {job.fitScore ?? 'unknown'}</span>
              </div>

              {job.url && (
                <a href={job.url} target="_blank" rel="noreferrer" className="job-hunt-job-card__link">
                  Open job link
                </a>
              )}

              <div className="job-hunt-job-card__controls">
                <GuidedJobSelect
                  label="Status"
                  value={job.status}
                  options={STATUS_OPTIONS}
                  onChange={(value) => onStatusChange(job.id, value as JobApplicationStatus)}
                />

                <GuidedJobSelect
                  label="Remote type"
                  value={job.remoteType ?? 'unknown'}
                  options={REMOTE_OPTIONS}
                  onChange={(value) => onRemoteTypeChange(job.id, value as JobRemoteType)}
                />

                <GuidedJobSelect
                  label="Fit score"
                  value={job.fitScore ?? 'unknown'}
                  options={FIT_OPTIONS}
                  onChange={(value) => onFitScoreChange(job.id, value as JobFitScore)}
                />

                <label>
                  Notes
                  <textarea
                    className="field-textarea"
                    value={job.notes ?? ''}
                    onChange={(event) => onNotesChange(job.id, event.target.value)}
                    placeholder="Application notes"
                  />
                </label>
              </div>

              <button
                type="button"
                className="memory-cleanup-preview__ghost-btn"
                onClick={() => onDelete(job.id)}
              >
                Delete job
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
