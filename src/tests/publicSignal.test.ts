import {
  assessPublicSignal,
  isMaintenanceOnlySignal,
} from '../utils/publicSignal';

describe('public signal scoring', () => {
  it('weights visible product momentum above maintenance updates', () => {
    const high = assessPublicSignal('Added Daily Content Pack generation');
    const low = assessPublicSignal('Last session summary updated');

    expect(high.level).toBe('high');
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.reasons).toEqual(expect.arrayContaining(['Launch Studio capability']));
    expect(low.reasons).toEqual(expect.arrayContaining(['down-ranked: internal session bookkeeping']));
  });

  it('recognises trust, workflow, onboarding, and UX improvements as public-facing', () => {
    expect(assessPublicSignal('Fixed OAuth session persistence').level).toBe('high');
    expect(assessPublicSignal('Improved cross-AI export flow').level).toBe('high');
    expect(assessPublicSignal('Improved mobile export UX').level).toBe('high');
    expect(assessPublicSignal('Added Export History compare').level).toBe('high');
  });

  it('detects maintenance-only updates explainably', () => {
    expect(isMaintenanceOnlySignal('Metadata changed')).toBe(true);
    expect(isMaintenanceOnlySignal('Project updated')).toBe(true);
    expect(isMaintenanceOnlySignal('Items added by AI')).toBe(true);
    expect(isMaintenanceOnlySignal('Added Launch Studio separation')).toBe(false);
  });
});
