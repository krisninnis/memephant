import type { JobItem } from '../types';

type Props = {
  job: JobItem | null;
};

function row(label: string, value: string | undefined) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || 'Not specified'}</strong>
    </div>
  );
}

export function JobDetailPanel({ job }: Props) {
  return (
    <section className="job-hunt-card" aria-label="Selected Job Details">
      <div className="job-hunt-card__header">
        <div>
          <div className="field-label">Selected Job</div>
          <h2>{job?.title || 'No job selected'}</h2>
        </div>
      </div>

      {!job ? (
        <div className="job-hunt-empty">
          <strong>Select a job.</strong>
          <p>Job details and prompt tools will appear here.</p>
        </div>
      ) : (
        <>
          <div className="job-hunt-detail-grid">
            {row('Company', job.company)}
            {row('Location', job.location)}
            {row('Remote type', job.remoteType)}
            {row('Salary', job.salary)}
            {row('Fit score', job.fitScore)}
            {row('Status', job.status)}
            {row('Source', job.source)}
          </div>

          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" className="job-hunt-detail-link">
              Open original job advert
            </a>
          )}

          <label>
            Pasted source text
            <textarea
              className="field-textarea job-hunt-source"
              value={job.pastedText ?? ''}
              readOnly
            />
          </label>
        </>
      )}
    </section>
  );
}
