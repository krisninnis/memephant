import { useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type {
  ProjectBlueprintInput,
  ProjectBlueprintPreference,
  ProjectBlueprintPrimaryAI,
  ProjectBlueprintProjectType,
  ProjectBlueprintQuality,
  ProjectBlueprintWorkingStyle,
} from '../../types/memphant-types';
import {
  createDefaultProjectBlueprintInput,
  createProjectFromBlueprint,
  generateProjectBlueprint,
} from '../../utils/projectBlueprintGenerator';
import { saveToDisk } from '../../services/tauriActions';
import { BlueprintPreview } from './BlueprintPreview';
import './BlueprintWizard.css';

type BlueprintStep = 'basics' | 'type' | 'technical' | 'workflow' | 'preview';

interface BlueprintWizardProps {
  onClose: () => void;
  onProjectCreated?: () => void;
}

const STEPS: BlueprintStep[] = ['basics', 'type', 'technical', 'workflow', 'preview'];

const PROJECT_TYPES: Array<{ value: ProjectBlueprintProjectType; label: string }> = [
  { value: 'saas', label: 'SaaS' },
  { value: 'desktop-app', label: 'Desktop App' },
  { value: 'mobile-app', label: 'Mobile App' },
  { value: 'ai-tool', label: 'AI Tool' },
  { value: 'browser-extension', label: 'Browser Extension' },
  { value: 'api', label: 'API' },
  { value: 'internal-tool', label: 'Internal Tool' },
  { value: 'game', label: 'Game' },
  { value: 'content-business', label: 'Content Business' },
  { value: 'other', label: 'Other' },
];

const QUALITY_OPTIONS: Array<{ value: ProjectBlueprintQuality; label: string }> = [
  { value: 'beginner-friendly', label: 'Beginner-friendly' },
  { value: 'production-grade', label: 'Production-grade' },
];

const WORKING_STYLES: Array<{ value: ProjectBlueprintWorkingStyle; label: string }> = [
  { value: 'solo-founder', label: 'Solo founder' },
  { value: 'small-team', label: 'Small team' },
  { value: 'agency', label: 'Agency' },
  { value: 'hobby-project', label: 'Hobby project' },
];

const PRIMARY_AI_OPTIONS: Array<{ value: ProjectBlueprintPrimaryAI; label: string }> = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'grok', label: 'Grok' },
  { value: 'other', label: 'Other' },
];

const PREFERENCE_OPTIONS: Array<{ value: ProjectBlueprintPreference; label: string }> = [
  { value: 'unsure', label: 'Unsure' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

function stepLabel(step: BlueprintStep): string {
  switch (step) {
    case 'basics':
      return 'Project Basics';
    case 'type':
      return 'Project Type';
    case 'technical':
      return 'Technical Preferences';
    case 'workflow':
      return 'Working Style';
    case 'preview':
      return 'Preview';
  }
}

function canLeaveBasics(input: ProjectBlueprintInput): boolean {
  return Boolean(
    input.projectName.trim() &&
    input.idea.trim() &&
    input.problem.trim() &&
    input.targetAudience.trim() &&
    input.desiredOutcome.trim(),
  );
}

export function BlueprintWizard({ onClose, onProjectCreated }: BlueprintWizardProps) {
  const addProject = useProjectStore((s) => s.addProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setCurrentView = useProjectStore((s) => s.setCurrentView);
  const showToast = useProjectStore((s) => s.showToast);
  const [step, setStep] = useState<BlueprintStep>('basics');
  const [input, setInput] = useState<ProjectBlueprintInput>(() => createDefaultProjectBlueprintInput());
  const [saving, setSaving] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [error, setError] = useState('');

  const stepIndex = STEPS.indexOf(step);
  const blueprint = useMemo(
    () => generateProjectBlueprint(input, '1970-01-01T00:00:00.000Z'),
    [input],
  );
  const canContinue = step === 'basics' ? canLeaveBasics(input) : true;

  const update = <K extends keyof ProjectBlueprintInput>(
    key: K,
    value: ProjectBlueprintInput[K],
  ) => {
    setInput((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const goNext = () => {
    if (!canContinue) {
      setError('Fill in the basics first so Memephant can create useful project context.');
      return;
    }

    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)] ?? 'preview');
  };

  const goBack = () => {
    setStep(STEPS[Math.max(stepIndex - 1, 0)] ?? 'basics');
  };

  const handleCopy = async (markdown: string) => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('failed');
    }
  };

  const handleCreateProject = async () => {
    if (!canLeaveBasics(input) || saving) return;
    setSaving(true);
    setError('');

    try {
      const project = createProjectFromBlueprint(input, new Date().toISOString());
      await saveToDisk(project);
      addProject(project);
      setActiveProject(project.id);
      setCurrentView('projects');
      showToast(`"${project.name}" created from Project Blueprint.`);
      onProjectCreated?.();
      onClose();
    } catch (err) {
      console.error('Project Blueprint create failed:', err);
      setError('Could not create the project blueprint. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="blueprint-backdrop" role="presentation">
      <section className="blueprint-modal" role="dialog" aria-modal="true" aria-label="New Project Blueprint">
        <header className="blueprint-header">
          <div>
            <p className="blueprint-eyebrow">Project Blueprint</p>
            <h2>Start with complete context</h2>
            <p>
              Plan the project, seed the Context Passport, and save a project memory before writing code.
            </p>
          </div>

          <button type="button" className="blueprint-close" onClick={onClose} aria-label="Close Project Blueprint">
            x
          </button>
        </header>

        <nav className="blueprint-steps" aria-label="Project Blueprint steps">
          {STEPS.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`blueprint-step${item === step ? ' blueprint-step--active' : ''}`}
              onClick={() => {
                if (item !== 'basics' && !canLeaveBasics(input)) {
                  setError('Fill in the basics first so Memephant can create useful project context.');
                  return;
                }
                setStep(item);
              }}
            >
              <span>{index + 1}</span>
              {stepLabel(item)}
            </button>
          ))}
        </nav>

        <div className="blueprint-body">
          {step === 'basics' && (
            <div className="blueprint-form">
              <label>
                Project name
                <input
                  value={input.projectName}
                  onChange={(event) => update('projectName', event.target.value)}
                  placeholder="Example: Client Context Hub"
                />
              </label>

              <label>
                One-sentence idea
                <textarea
                  value={input.idea}
                  onChange={(event) => update('idea', event.target.value)}
                  placeholder="Example: A local-first workspace that keeps client project context ready for any AI tool."
                />
              </label>

              <label>
                Problem being solved
                <textarea
                  value={input.problem}
                  onChange={(event) => update('problem', event.target.value)}
                  placeholder="Example: Freelancers lose time re-explaining the same project every time they switch AI tools."
                />
              </label>

              <label>
                Target audience
                <input
                  value={input.targetAudience}
                  onChange={(event) => update('targetAudience', event.target.value)}
                  placeholder="Example: Freelancers managing several client projects"
                />
              </label>

              <label>
                Desired outcome
                <input
                  value={input.desiredOutcome}
                  onChange={(event) => update('desiredOutcome', event.target.value)}
                  placeholder="Example: continue work instantly without rebuilding context"
                />
              </label>
            </div>
          )}

          {step === 'type' && (
            <div className="blueprint-form">
              <label>
                Project type
                <select
                  value={input.projectType}
                  onChange={(event) => update('projectType', event.target.value as ProjectBlueprintProjectType)}
                >
                  {PROJECT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              {input.projectType === 'other' && (
                <label>
                  Describe the project type
                  <input
                    value={input.otherProjectType ?? ''}
                    onChange={(event) => update('otherProjectType', event.target.value)}
                    placeholder="Example: developer education product"
                  />
                </label>
              )}
            </div>
          )}

          {step === 'technical' && (
            <div className="blueprint-form blueprint-form--grid">
              <label>
                Build approach
                <select
                  value={input.quality}
                  onChange={(event) => update('quality', event.target.value as ProjectBlueprintQuality)}
                >
                  {QUALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Preferred stack
                <input
                  value={input.preferredStack ?? ''}
                  onChange={(event) => update('preferredStack', event.target.value)}
                  placeholder="Example: React, Tauri, SQLite"
                />
              </label>

              {([
                ['localFirst', 'Local-first?'],
                ['authentication', 'Authentication needed?'],
                ['payments', 'Payments needed?'],
                ['database', 'Database needed?'],
                ['aiIntegrations', 'AI integrations needed?'],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <select
                    value={input[key]}
                    onChange={(event) => update(key, event.target.value as ProjectBlueprintPreference)}
                  >
                    {PREFERENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}

          {step === 'workflow' && (
            <div className="blueprint-form blueprint-form--grid">
              <label>
                Working style
                <select
                  value={input.workingStyle}
                  onChange={(event) => update('workingStyle', event.target.value as ProjectBlueprintWorkingStyle)}
                >
                  {WORKING_STYLES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Primary AI
                <select
                  value={input.primaryAI}
                  onChange={(event) => update('primaryAI', event.target.value as ProjectBlueprintPrimaryAI)}
                >
                  {PRIMARY_AI_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              {input.primaryAI === 'other' && (
                <label>
                  Which AI?
                  <input
                    value={input.otherPrimaryAI ?? ''}
                    onChange={(event) => update('otherPrimaryAI', event.target.value)}
                    placeholder="Example: local model"
                  />
                </label>
              )}
            </div>
          )}

          {step === 'preview' && (
            <BlueprintPreview blueprint={blueprint} onCopy={(markdown) => void handleCopy(markdown)} />
          )}
        </div>

        {error && <p className="blueprint-error">{error}</p>}
        {copyState === 'copied' && <p className="blueprint-note">Blueprint copied.</p>}
        {copyState === 'failed' && <p className="blueprint-error">Could not copy the blueprint.</p>}

        <footer className="blueprint-footer">
          <button type="button" className="blueprint-secondary" onClick={step === 'basics' ? onClose : goBack}>
            {step === 'basics' ? 'Cancel' : 'Back'}
          </button>

          {step !== 'preview' ? (
            <button type="button" className="blueprint-primary" onClick={goNext} disabled={!canContinue}>
              Continue
            </button>
          ) : (
            <button type="button" className="blueprint-primary" onClick={() => void handleCreateProject()} disabled={saving}>
              {saving ? 'Saving...' : 'Create Project'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

export default BlueprintWizard;
