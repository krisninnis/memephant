import { cleanPublicText } from './contextQuality';

export type PublicSignalLevel = 'high' | 'medium' | 'low';

export type PublicSignalAssessment = {
  text: string;
  score: number;
  level: PublicSignalLevel;
  reasons: string[];
};

const HIGH_SIGNAL_WEIGHTS: Array<[RegExp, number, string]> = [
  [/\b(add|added|ship|shipped|launch|launched)\b/i, 8, 'shipping momentum'],
  [/\b(improve|improved|fix|fixed|refine|refined|polish|polished)\b/i, 6, 'visible improvement'],
  [/\b(onboarding|demo|ux|mobile|timeline|compare|history)\b/i, 10, 'user-facing experience'],
  [/\b(auth|oauth|session|privacy|trust|security)\b/i, 10, 'trust or access improvement'],
  [/\b(workflow|continuity|cross-ai|export|passport|handoff)\b/i, 9, 'workflow continuity'],
  [/\b(launch studio|daily content pack|content readiness|shipping highlights)\b/i, 12, 'Launch Studio capability'],
  [/\b(users?|customers?|founders?|teams?|builders?)\b/i, 4, 'clear user relevance'],
];

const LOW_SIGNAL_WEIGHTS: Array<[RegExp, number, string]> = [
  [/\blast session summary updated\b/i, -18, 'internal session bookkeeping'],
  [/\bprepared next step\b/i, -18, 'planning task'],
  [/\bnext up\b/i, -12, 'planning task'],
  [/\bproject updated\b/i, -16, 'generic project bookkeeping'],
  [/\bmetadata changed\b/i, -16, 'metadata-only update'],
  [/\bnotes synced\b/i, -14, 'sync bookkeeping'],
  [/\bsession state saved\b/i, -18, 'internal state save'],
  [/\bexport checkpoint created\b/i, -20, 'export checkpoint bookkeeping'],
  [/\b(items?|decisions?|goals?|rules?|questions?)\s+(added|updated|removed)\s+by\s+ai\b/i, -22, 'AI bookkeeping'],
  [/\b\d+\s+(items?|decisions?|goals?|rules?|questions?)\s+(added|updated|removed)(\s+by\s+ai)?\b/i, -22, 'bulk internal count'],
  [/\bdecisions? updated\b/i, -12, 'decision bookkeeping without public outcome'],
  [/\bsettings saved\b/i, -14, 'settings bookkeeping'],
];

function levelForScore(score: number): PublicSignalLevel {
  if (score >= 18) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

export function assessPublicSignal(value: string): PublicSignalAssessment {
  const text = cleanPublicText(value);
  if (!text) {
    return {
      text: '',
      score: 0,
      level: 'low',
      reasons: ['empty or placeholder text'],
    };
  }

  const reasons: string[] = [];
  let score = text.split(/\s+/).length >= 4 ? 4 : 0;

  HIGH_SIGNAL_WEIGHTS.forEach(([pattern, weight, reason]) => {
    if (pattern.test(text)) {
      score += weight;
      reasons.push(reason);
    }
  });

  LOW_SIGNAL_WEIGHTS.forEach(([pattern, weight, reason]) => {
    if (pattern.test(text)) {
      score += weight;
      reasons.push(`down-ranked: ${reason}`);
    }
  });

  return {
    text,
    score: Math.max(0, score),
    level: levelForScore(score),
    reasons,
  };
}

export function isMaintenanceOnlySignal(value: string): boolean {
  const assessment = assessPublicSignal(value);
  return assessment.level === 'low' && assessment.reasons.some((reason) => reason.startsWith('down-ranked:'));
}
