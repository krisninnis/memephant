import { useMemo, useState } from 'react';
import { useProjectStore } from '../../../store/projectStore';
import { generateJobPrompt, getJobPromptLabel } from '../jobPromptGenerator';
import type { JobHuntProfile, JobItem, JobPromptType } from '../types';

const PROMPT_TYPES: JobPromptType[] = [
  'tailor_cv',
  'cover_message',
  'interview_prep',
  'fit_analysis',
];

type Props = {
  profile: JobHuntProfile;
  job: JobItem | null;
};

export function JobPromptPanel({ profile, job }: Props) {
  const [promptType, setPromptType] = useState<JobPromptType>('tailor_cv');
  const showToast = useProjectStore((state) => state.showToast);
  const prompt = useMemo(
    () => (job ? generateJobPrompt(promptType, profile, job) : ''),
    [job, profile, promptType],
  );

  const copyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      showToast('Job prompt copied.', 'info');
    } catch {
      showToast('Could not copy job prompt.', 'error');
    }
  };

  return (
    <section className="job-hunt-card" aria-label="Job AI Prompts">
      <div className="job-hunt-card__header">
        <div>
          <div className="field-label">AI Prompts</div>
          <h2>Copy-ready application help</h2>
        </div>
      </div>

      <div className="job-hunt-prompt-tabs" role="tablist" aria-label="Job prompt type">
        {PROMPT_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`job-hunt-prompt-tabs__button${promptType === type ? ' job-hunt-prompt-tabs__button--active' : ''}`}
            onClick={() => setPromptType(type)}
          >
            {getJobPromptLabel(type)}
          </button>
        ))}
      </div>

      <textarea
        className="field-textarea job-hunt-prompt-preview"
        value={prompt || 'Select a job to generate prompts.'}
        readOnly
      />

      <button
        type="button"
        className="github-scan-btn"
        onClick={copyPrompt}
        disabled={!job}
      >
        Copy prompt
      </button>
    </section>
  );
}
