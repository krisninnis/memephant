import type { JobHuntProfile } from '../types';

const OTHER_VALUE = '__other__';

const TARGET_ROLE_PRESETS = [
  'Frontend Developer',
  'Junior Developer',
  'Web Developer',
  'Software Engineer',
  'AI Engineer',
  'Data Analyst',
  'IT Support',
  'Automation Specialist',
  'Low-code Developer',
  'Game Developer',
  'Roblox Developer',
];

const EXPERIENCE_LEVEL_PRESETS = [
  'Entry level',
  'Junior',
  'Graduate',
  'Mid-level',
  'Career switcher',
  'Self-taught / portfolio-based',
];

const PREFERRED_REMOTE_PRESETS = [
  { value: 'any', label: 'Any' },
  { value: 'remote', label: 'Fully remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
  { value: 'remote_uk_only', label: 'Remote UK only' },
];

const KEY_SKILL_PRESETS = [
  'TypeScript',
  'React',
  'JavaScript',
  'HTML',
  'CSS',
  'Python',
  'SQL',
  'WordPress',
  'Accessibility',
  'GitHub',
  'AWS',
  'Supabase',
  'Tauri',
  'Roblox',
  'Luau',
];

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

function selectedPresetValue(value: string | undefined, presets: Array<string | { value: string; label: string }>): string {
  const raw = value?.trim() ?? '';
  if (!raw) return '';
  return presets.some((preset) => (typeof preset === 'string' ? preset : preset.value) === raw) ? raw : OTHER_VALUE;
}

function GuidedSelect({
  label,
  value,
  presets,
  placeholder = 'Choose a preset...',
  customPlaceholder = 'Type a custom value',
  onChange,
}: {
  label: string;
  value: string | undefined;
  presets: Array<string | { value: string; label: string }>;
  placeholder?: string;
  customPlaceholder?: string;
  onChange: (value: string) => void;
}) {
  const selectValue = selectedPresetValue(value, presets);

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
          <option value="">{placeholder}</option>
          {presets.map((preset) => {
            const option = typeof preset === 'string' ? { value: preset, label: preset } : preset;
            return <option key={option.value} value={option.value}>{option.label}</option>;
          })}
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
            placeholder={customPlaceholder}
          />
        </label>
      )}
    </div>
  );
}

export function JobHuntProfilePanel({ profile, onChange }: Props) {
  const addSkill = (skill: string) => {
    if (profile.keySkills.some((item) => item.toLowerCase() === skill.toLowerCase())) return;
    onChange({ ...profile, keySkills: [...profile.keySkills, skill] });
  };

  return (
    <section className="job-hunt-card" aria-label="Job Hunt Profile">
      <div className="job-hunt-card__header">
        <div>
          <div className="field-label">Job Hunt Profile</div>
          <h2>Application context</h2>
        </div>
      </div>

      <div className="job-hunt-form-grid">
        <div className="job-hunt-guided-field">
          <GuidedSelect
            label="Target role"
            value={profile.targetRoles[0] ?? ''}
            presets={TARGET_ROLE_PRESETS}
            onChange={(value) => onChange({ ...profile, targetRoles: value ? [value, ...profile.targetRoles.slice(1)] : profile.targetRoles.slice(1) })}
            customPlaceholder="Example: Creative technologist"
          />
          <label>
            Additional target roles
            <textarea
              className="field-textarea"
              value={joinLines(profile.targetRoles.slice(1))}
              onChange={(event) => {
                const first = profile.targetRoles[0] ? [profile.targetRoles[0]] : [];
                onChange({ ...profile, targetRoles: [...first, ...splitLines(event.target.value)] });
              }}
              placeholder="Optional extra roles"
            />
          </label>
        </div>

        <label>
          Target locations
          <textarea
            className="field-textarea"
            value={joinLines(profile.targetLocations)}
            onChange={(event) => onChange({ ...profile, targetLocations: splitLines(event.target.value) })}
            placeholder="London&#10;Remote UK"
          />
        </label>

        <GuidedSelect
          label="Experience level"
          value={profile.experienceLevel ?? ''}
          presets={EXPERIENCE_LEVEL_PRESETS}
          onChange={(value) => onChange({ ...profile, experienceLevel: value })}
          customPlaceholder="Example: Returning to tech after a break"
        />

        <GuidedSelect
          label="Preferred remote type"
          value={profile.preferredRemoteType ?? 'any'}
          presets={PREFERRED_REMOTE_PRESETS}
          onChange={(value) => onChange({ ...profile, preferredRemoteType: value as JobHuntProfile['preferredRemoteType'] })}
          customPlaceholder="Example: Mostly remote, 1 day/month onsite"
        />

        <label>
          CV summary
          <textarea
            className="field-textarea"
            value={profile.cvSummary ?? ''}
            onChange={(event) => onChange({ ...profile, cvSummary: event.target.value })}
            placeholder="Short honest summary of your experience"
          />
        </label>

        <div className="job-hunt-guided-field">
          <span className="job-hunt-field-label">Key skills</span>
          <div className="job-hunt-skill-chips" aria-label="Quick-add key skills">
            {KEY_SKILL_PRESETS.map((skill) => (
              <button
                key={skill}
                type="button"
                className="job-hunt-skill-chip"
                onClick={() => addSkill(skill)}
                disabled={profile.keySkills.some((item) => item.toLowerCase() === skill.toLowerCase())}
              >
                {skill}
              </button>
            ))}
          </div>
          <label>
            Key skills
          <textarea
            className="field-textarea"
            value={joinLines(profile.keySkills)}
            onChange={(event) => onChange({ ...profile, keySkills: splitLines(event.target.value) })}
            placeholder="TypeScript&#10;React&#10;Accessibility"
          />
          </label>
        </div>

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
