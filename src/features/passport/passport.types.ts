// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Memephant Passport â€” Type Definitions
// Schema v1.0 â€” all fields optional-safe for future additions
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type CommunicationStyle =
  | "structured"
  | "step-by-step"
  | "concise"
  | "collaborative"
  | "technical";

export type WorkingTone =
  | "friendly"
  | "professional"
  | "direct"
  | "technical"
  | "creative";

export type FocusArea =
  | "startup"
  | "app"
  | "game"
  | "research"
  | "business"
  | "writing"
  | "other";

export interface PassportConfigurationV2 {
  preferredName: string;
  region: string;
  languagePreference: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  directness: string;
  technicalLevel: string;
  riskTolerance: string;
  roleContext: string;
  alwaysRules: string[];
  neverRules: string[];
  updatedAt?: string;
}

export const DEFAULT_PASSPORT_CONFIGURATION_V2: PassportConfigurationV2 = {
  preferredName: "",
  region: "United Kingdom",
  languagePreference: "British English",
  timezone: "Europe/London",
  dateFormat: "DD/MM/YYYY",
  currency: "GBP / \u00a3",
  directness: "Honest but supportive",
  technicalLevel: "Learning builder",
  riskTolerance: "Prefer small safe patches",
  roleContext: "",
  alwaysRules: [
    "Ask before assuming missing details.",
    "Be honest when unsure.",
    "Give exact next steps.",
  ],
  neverRules: [
    "Do not ask for passwords, API keys, or secrets.",
    "Do not invent files or code that have not been shown.",
    "Do not suggest broad rewrites before small safe fixes.",
  ],
};

/** The passport creation flow: 3 quick calibration questions, optional details, card, preview. */
export type PassportFlowStep =
  | "welcome"
  | "q1"
  | "q2"
  | "q3"
  | "configure"
  | "generating"
  | "complete"
  | "preview";

/** The three calibration answers that form a passport */
export interface PassportProfile {
  communicationStyle: CommunicationStyle;
  tone: WorkingTone;
  focusArea: FocusArea;
}

/** The complete, persisted passport record */
export interface PassportData {
  /** Branded ID -- e.g. "MPH-A4F2-19C8-7BE1" */
  id: string;
  /** 16-character uppercase hex, deterministic from profile */
  fingerprint: string;
  /** The three calibration answers */
  profile: PassportProfile;
  /** Richer local-only working preferences configured after onboarding */
  configuration?: PassportConfigurationV2;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Schema version -- increment on breaking changes */
  schemaVersion: "1.0";
}

// â”€â”€ Store shape â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface PassportStoreState {
  /** null = passport not yet created */
  passport: PassportData | null;
  /** Current step in the creation flow (not persisted -- restarts fresh) */
  flowStep: PassportFlowStep;
  /** Partial answers accumulating during calibration */
  draft: Partial<PassportProfile>;
  /** True during the artificial generation delay */
  isGenerating: boolean;
  /** True only for the current app session when the first Passport screen is skipped. */
  passportFlowSkipped: boolean;
  /**
   * True when an existing user has chosen to re-edit their passport from the
   * PassportBadgeButton. Forces PassportGate to show the flow even for users
   * who have hasSeenOnboarding = true. Cleared when "Enter Memephant" is clicked.
   * Not persisted -- resets to false on every app launch.
   */
  isReeditingPassport: boolean;
}

export interface PassportStoreActions {
  setFlowStep: (step: PassportFlowStep) => void;
  setDraftAnswer: <K extends keyof PassportProfile>(
    key: K,
    value: PassportProfile[K],
  ) => void;
  generatePassport: (configuration?: Partial<PassportConfigurationV2>) => void;
  updatePassportConfiguration: (
    updates: Partial<PassportConfigurationV2>,
  ) => void;
  resetPassport: () => void;
  /** Let a new user continue without creating a Passport in this session. */
  skipPassportFlow: () => void;
  /** Re-enter the passport creation flow for an existing user. */
  startPassportEdit: () => void;
  /** Called by "Enter Memephant" -- clears the re-editing flag and releases the gate. */
  finishPassportFlow: () => void;
}

export type PassportStore = PassportStoreState & PassportStoreActions;

// â”€â”€ Question data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CalibrationOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface CalibrationQuestion<T extends string> {
  step: PassportFlowStep;
  profileKey: keyof PassportProfile;
  number: string;
  prompt: string;
  options: CalibrationOption<T>[];
}
