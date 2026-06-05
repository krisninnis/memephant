import { useMemo } from 'react';
import { useJobHuntStore } from '../jobHuntStore';
import { JobDetailPanel } from './JobDetailPanel';
import { JobHuntProfilePanel } from './JobHuntProfilePanel';
import { JobPromptPanel } from './JobPromptPanel';
import { JobTrackerList } from './JobTrackerList';
import { PasteJobsPanel } from './PasteJobsPanel';

export function JobHuntPage() {
  const profile = useJobHuntStore((state) => state.profile);
  const jobs = useJobHuntStore((state) => state.jobs);
  const selectedJobId = useJobHuntStore((state) => state.selectedJobId);
  const lastImportCount = useJobHuntStore((state) => state.lastImportCount);
  const updateProfile = useJobHuntStore((state) => state.updateProfile);
  const importJobsFromText = useJobHuntStore((state) => state.importJobsFromText);
  const selectJob = useJobHuntStore((state) => state.selectJob);
  const updateJobStatus = useJobHuntStore((state) => state.updateJobStatus);
  const updateJob = useJobHuntStore((state) => state.updateJob);
  const deleteJob = useJobHuntStore((state) => state.deleteJob);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId],
  );

  return (
    <div className="workspace-scroll workspace-scroll--job-hunt">
      <div className="workspace-main job-hunt-page">
        <header className="job-hunt-hero">
          <div>
            <div className="field-label">Job Hunt Passport</div>
            <h1>Local job tracker and application prompts</h1>
            <p>
              Paste roles from ChatGPT, track applications locally, and copy prompts that keep your CV honest.
            </p>
          </div>
          <span>Local only</span>
        </header>

        <div className="job-hunt-layout">
          <div className="job-hunt-layout__left">
            <JobHuntProfilePanel profile={profile} onChange={updateProfile} />
            <PasteJobsPanel onImport={importJobsFromText} lastImportCount={lastImportCount} />
            <JobTrackerList
              jobs={jobs}
              selectedJobId={selectedJob?.id ?? null}
              onSelect={selectJob}
              onStatusChange={updateJobStatus}
              onNotesChange={(id, notes) => updateJob(id, { notes })}
              onDelete={deleteJob}
            />
          </div>

          <div className="job-hunt-layout__right">
            <JobDetailPanel job={selectedJob} />
            <JobPromptPanel profile={profile} job={selectedJob} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobHuntPage;
