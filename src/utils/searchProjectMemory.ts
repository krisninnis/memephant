import type { ProjectMemory } from '../types/memphant-types';

export type ProjectSearchSection =
  | 'Project'
  | 'Summary'
  | 'Current State'
  | 'Goal'
  | 'Decision'
  | 'Rule'
  | 'Next Step'
  | 'File'
  | 'Open Question';

export interface ProjectSearchResult {
  id: string;
  projectId: string;
  projectName: string;
  section: ProjectSearchSection;
  snippet: string;
  score: number;
}

interface SearchField {
  section: ProjectSearchSection;
  text: string;
  score: number;
  index: number;
}

function normalise(value: string): string {
  return value.toLocaleLowerCase();
}

function makeSnippet(text: string, query: string, maxLength = 96): string {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (cleanText.length <= maxLength) return cleanText;

  const index = normalise(cleanText).indexOf(normalise(query));
  if (index < 0) return `${cleanText.slice(0, maxLength - 1).trimEnd()}...`;

  const half = Math.floor((maxLength - query.length) / 2);
  const start = Math.max(0, index - half);
  const end = Math.min(cleanText.length, start + maxLength);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < cleanText.length ? '...' : '';

  return `${prefix}${cleanText.slice(start, end).trim()}${suffix}`;
}

function addTextField(
  fields: SearchField[],
  section: ProjectSearchSection,
  text: string | undefined,
  score: number,
): void {
  if (!text?.trim()) return;
  fields.push({ section, text, score, index: fields.length });
}

function getProjectSearchFields(project: ProjectMemory): SearchField[] {
  const fields: SearchField[] = [];
  addTextField(fields, 'Project', project.name, 100);
  addTextField(fields, 'Summary', project.summary, 80);
  addTextField(fields, 'Current State', project.currentState, 76);

  project.goals.forEach((goal) => addTextField(fields, 'Goal', goal, 70));
  project.decisions.forEach((decision) => {
    addTextField(fields, 'Decision', decision.decision, 68);
    addTextField(fields, 'Decision', decision.rationale, 62);
  });
  project.rules.forEach((rule) => addTextField(fields, 'Rule', rule, 66));
  project.nextSteps.forEach((step) => addTextField(fields, 'Next Step', step, 64));
  project.importantAssets.forEach((asset) => addTextField(fields, 'File', asset, 72));
  project.openQuestions.forEach((question) => addTextField(fields, 'Open Question', question, 60));

  return fields;
}

export function searchProjectMemory(
  projects: ProjectMemory[],
  query: string,
  limit = 24,
): ProjectSearchResult[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const normalisedQuery = normalise(trimmedQuery);
  const results: ProjectSearchResult[] = [];

  projects.forEach((project, projectIndex) => {
    getProjectSearchFields(project).forEach((field) => {
      const matchIndex = normalise(field.text).indexOf(normalisedQuery);
      if (matchIndex < 0) return;

      const startsWithBoost = matchIndex === 0 ? 8 : 0;
      results.push({
        id: `${project.id}:${field.section}:${field.index}`,
        projectId: project.id,
        projectName: project.name,
        section: field.section,
        snippet: makeSnippet(field.text, trimmedQuery),
        score: field.score + startsWithBoost - projectIndex / 1000,
      });
    });
  });

  return results
    .sort((a, b) => b.score - a.score || a.projectName.localeCompare(b.projectName))
    .slice(0, limit);
}
