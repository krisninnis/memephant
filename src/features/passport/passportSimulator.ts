import type { PassportData } from './passport.types';
import { getPassportConfiguration } from './passport.utils';

export type PassportSimulation = {
  prompt: string;
  genericResponse: string;
  passportResponse: string;
};

const SIMULATED_PROMPT = 'Help me decide what to work on next.';

function compact(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function languageGuidance(languagePreference: string): string {
  const language = compact(languagePreference, 'Neutral English');
  const lower = language.toLowerCase();

  if (lower.includes('british')) {
    return 'I will use British English, UK phrasing, and words like organise, colour, and behaviour.';
  }

  if (lower.includes('american')) {
    return 'I will use American English and US phrasing.';
  }

  if (lower.includes('canadian')) {
    return 'I will use Canadian English and region-aware phrasing.';
  }

  if (lower.includes('australian')) {
    return 'I will use Australian English and region-aware phrasing.';
  }

  return `I will use ${language} and avoid assuming local conventions.`;
}

export function buildPassportSimulation(passport: PassportData): PassportSimulation {
  const configuration = getPassportConfiguration(passport);
  const preferredName = configuration.preferredName.trim();
  const greeting = preferredName ? `${preferredName}, ` : '';
  const region = compact(configuration.region, 'your region');
  const directness = compact(configuration.directness, 'balanced');
  const technicalLevel = compact(configuration.technicalLevel, 'your current level');
  const riskTolerance = compact(configuration.riskTolerance, 'balanced');
  const alwaysRule = configuration.alwaysRules[0]?.trim();

  const passportResponse = [
    `${greeting}I would start by choosing the next task that reduces the most uncertainty without creating avoidable rework.`,
    `${languageGuidance(configuration.languagePreference)} I will also keep regional assumptions aligned with ${region}.`,
    `Directness: ${directness}. So the practical answer is: pick one focused next step, define what success looks like, and avoid turning it into a broad rewrite.`,
    `Technical level: ${technicalLevel}. I will explain the trade-offs clearly and give exact next steps rather than assuming you want abstract strategy.`,
    `Risk tolerance: ${riskTolerance}. Start with the smallest reversible move, then validate before expanding scope.`,
    alwaysRule ? `Working rule I will follow: ${alwaysRule}` : 'Working rule I will follow: ask before assuming missing details.',
  ].join('\n\n');

  return {
    prompt: SIMULATED_PROMPT,
    genericResponse: [
      'You should review your current tasks and choose the most important one.',
      'A good approach is to compare urgency, impact, and effort, then make a short plan.',
      'After that, work on the first step and adjust as you learn more.',
    ].join('\n\n'),
    passportResponse,
  };
}
