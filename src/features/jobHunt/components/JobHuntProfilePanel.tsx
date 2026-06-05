import type { JobHuntProfile } from '../types';

type Props = {
  profile: JobHuntProfile;
  onChange: (profile: JobHuntProfile) => void;
};

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinLines(items: string[]): string {
  return items.join('\n');
}

export function JobHuntProfilePanel({ profile, onChange }: Props) {
  return (
    <section className="job-hunt-card" aria-label="Job Hunt Profile">
      <div className="job-hunt-card__header">
        <div>
          <div className="field-label">Job Hunt Profile</div>
          <h2>Application context</h2>
        </div>
      </div>

      <div className="job-hunt-form-grid">
        <label>
          Target roles
          <textarea
            className="field-textarea"
            value={joinLines(profile.targetRoles)}
            onChange={(event) => onChange({ ...profile, targetRoles: splitLines(event.target.value) })}
            placeholder="Frontend developer&#10;React engineer"
          />
        </label>

        <label>
          Target locations
          <textarea
            className="field-textarea"
            value={joinLines(profile.targetLocations)}
            onChange={(event) => onChange({ ...profile, targetLocations: splitLines(event.target.value) })}
            placeholder="London&#10;Remote UK"
          />
        </label>

        <label>
          Preferred remote type
          <select
            className="field-input"
            value={profile.preferredRemoteType ?? 'any'}
            onChange={(event) => onChange({ ...profile, preferredRemoteType: event.target.value as JobHuntProfile['preferredRemoteType'] })}
          >
            <option value="any">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </label>

        <label>
          CV summary
          <textarea
            className="field-textarea"
            value={profile.cvSummary ?? ''}
            onChange={(event) => onChange({ ...profile, cvSummary: event.target.value })}
            placeholder="Short honest summary of your experience"
          />
        </label>

        <label>
          Key skills
          <textarea
            className="field-textarea"
            value={joinLines(profile.keySkills)}
            onChange={(event) => onChange({ ...profile, keySkills: splitLines(event.target.value) })}
            placeholder="TypeScript&#10;React&#10;Accessibility"
          />
        </label>

        <label>
          Projects
          <textarea
            className="field-textarea"
            value={joinLines(profile.projects)}
            onChange={(event) => onChange({ ...profile, projects: splitLines(event.target.value) })}
            placeholder="Portfolio projects or relevant shipped work"
          />
        </label>

        <label className="job-hunt-form-grid__wide">
          Constraints
          <textarea
            className="field-textarea"
            value={profile.constraints ?? ''}
            onChange={(event) => onChange({ ...profile, constraints: event.target.value })}
            placeholder="Notice period, salary floor, visa constraints, schedule needs"
          />
        </label>
      </div>
    </section>
  );
}
