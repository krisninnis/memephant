import type { ProjectMemory } from '../types/memphant-types';
import { SCHEMA_VERSION } from '../types/memphant-types';

export const DEMO_PROJECT_ID = 'demo_memephant_landing_page_refresh';
export const DEMO_PROJECT_NAME = 'Memephant Landing Page Refresh';

export function createDemoProject(timestamp = new Date().toISOString()): ProjectMemory {
  return {
    schema_version: SCHEMA_VERSION,
    id: DEMO_PROJECT_ID,
    name: DEMO_PROJECT_NAME,
    updatedAt: timestamp,
    summary:
      'Refresh the Memephant landing page so new visitors understand Context Passport in under 30 seconds and feel confident trying a local-first AI handoff.',
    goals: [
      'Make the hero explain "Stop re-explaining your project to every AI."',
      'Show the Context Passport workflow with a concrete before-and-after example.',
      'Reassure users that exports are local, inspectable, and user-controlled.',
      'Create a demo-ready page section that works for launch videos and screenshots.',
    ],
    rules: [
      'Lead with context portability, not generic AI memory.',
      'Keep all claims concrete and privacy-safe.',
      'Do not imply Memephant sends project data directly to AI tools.',
      'Use plain language for beginners and avoid over-polished AI wording.',
    ],
    decisions: [
      {
        id: 'D-001',
        decision: 'Use "Context Passport" as the flagship export name.',
        rationale:
          'It describes the portable handoff better than memory-centric language and makes the cross-AI workflow easier to explain.',
        timestamp,
      },
      {
        id: 'D-002',
        decision: 'Keep the first call to action focused on trying the workflow.',
        rationale:
          'The fastest aha moment is seeing a populated project become a copyable Context Passport.',
        timestamp,
      },
    ],
    currentState:
      'The landing page has the right product direction, but the first screen still needs sharper proof of the cross-AI handoff. The next AI should tighten the hero, add a three-step workflow section, and preserve the local-first trust message.',
    nextSteps: [
      'Rewrite the hero headline and subcopy around Context Passport.',
      'Add a compact workflow: Create project, generate Context Passport, paste into any AI.',
      'Draft a short trust block explaining local-first exports and secret redaction.',
      'Prepare a 90-second demo script using this project as the example.',
    ],
    openQuestions: [
      'Should the first CTA say "Try Demo Project" or "Generate Context Passport"?',
      'Which AI platform should the demo video show first: ChatGPT, Claude, or Cursor?',
      'What proof point best communicates that project context stays user-controlled?',
    ],
    importantAssets: [
      'public/index.html',
      'src/components/Workspace/ExportButtons.tsx',
      'src/components/Workspace/ContextPassportModal.tsx',
      'docs/release/privacy-review-checklist.md',
      'demo-video-script.md',
    ],
    projectCharter:
      'This is a built-in demo project. Use it to show how Memephant turns project state into a portable Context Passport without requiring accounts, cloud sync, or hidden telemetry.',
    aiInstructions:
      'Work like a practical product partner. Keep recommendations specific, beginner-friendly, and easy to verify. When writing copy, use direct language and preserve the privacy-first positioning.',
    inProgress: [
      'Clarifying the first-run path so users can experience the Context Passport workflow immediately.',
      'Preparing launch assets that show a real project moving between AI tools.',
    ],
    lastSessionSummary:
      'The previous session aligned the product around Context Passport as the public-facing export name and deferred AI Passport onboarding so first-time users reach project continuity sooner.',
    openQuestion:
      'How can the landing page demonstrate the cross-AI handoff in the smallest amount of user effort?',
    checkpoints: [],
    restorePoints: [],
    changelog: [
      {
        timestamp,
        field: 'general',
        action: 'added',
        summary: 'Demo project created for first-run Context Passport onboarding',
        source: 'app',
      },
    ],
    platformState: {},
    workflowMode: 'launch',
    nextIds: {
      D: 3,
      R: 1,
      G: 1,
      Q: 1,
    },
  };
}
