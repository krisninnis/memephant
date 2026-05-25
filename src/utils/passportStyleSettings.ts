export type PassportStyleSettings = {
  avoidEmDashes: boolean;
  reduceAiPhrases: boolean;
  compactOutput: boolean;
  plainTextMode: boolean;
};

export const defaultPassportStyleSettings: PassportStyleSettings = {
  avoidEmDashes: false,
  reduceAiPhrases: false,
  compactOutput: false,
  plainTextMode: false,
};
