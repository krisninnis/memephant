import type { PassportStyleSettings } from './passportStyleSettings';

const AI_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/It's important to note that /g, ''],
  [/It is important to note that /g, ''],
  [/\bseamless\b/g, 'smooth'],
  [/\brobust\b/g, 'solid'],
  [/\bleverage\b/g, 'use'],
  [/\bdelve into\b/g, 'look at'],
  [/\bgame-changing\b/g, 'useful'],
  [/\bmoving forward\b/g, 'next'],
  [/\bstreamline\b/g, 'simplify'],
];

export function applyPassportStyleSettings(
  text: string,
  settings: PassportStyleSettings,
): string {
  let output = text;

  if (settings.avoidEmDashes) {
    output = output.replace(/—/g, ' - ');
  }

  if (settings.reduceAiPhrases) {
    for (const [pattern, replacement] of AI_PHRASE_REPLACEMENTS) {
      output = output.replace(pattern, replacement);
    }
  }

  return output;
}
