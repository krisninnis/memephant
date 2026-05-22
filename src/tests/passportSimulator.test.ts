import { buildPassportSimulation } from '../features/passport/passportSimulator';
import { createPassportData } from '../features/passport/passport.utils';
import type {
  PassportConfigurationV2,
  PassportData,
  PassportProfile,
} from '../features/passport/passport.types';

const FULL_PROFILE: PassportProfile = {
  communicationStyle: 'structured',
  tone: 'friendly',
  focusArea: 'startup',
};

function makePassport(overrides: Partial<PassportConfigurationV2> = {}): PassportData {
  return createPassportData(FULL_PROFILE, {
    preferredName: 'Kris',
    region: 'United Kingdom',
    languagePreference: 'British English',
    directness: 'Honest but supportive',
    technicalLevel: 'Learning builder',
    riskTolerance: 'Prefer small safe patches',
    alwaysRules: ['Ask before assuming missing details.'],
    neverRules: ['Do not invent files or code that have not been shown.'],
    ...overrides,
  });
}

describe('Passport Preview Simulator', () => {
  it('uses preferred name in the Passport-adapted response', () => {
    const simulation = buildPassportSimulation(makePassport());

    expect(simulation.passportResponse).toContain('Kris');
  });

  it('uses British English and selected language guidance', () => {
    const british = buildPassportSimulation(makePassport());
    const canadian = buildPassportSimulation(makePassport({ languagePreference: 'Canadian English' }));

    expect(british.passportResponse).toContain('British English');
    expect(british.passportResponse).toContain('organise');
    expect(canadian.passportResponse).toContain('Canadian English');
  });

  it('reflects directness, technical level, and risk tolerance', () => {
    const simulation = buildPassportSimulation(makePassport({
      directness: 'Challenge me hard',
      technicalLevel: 'Intermediate',
      riskTolerance: 'Experimental',
    }));

    expect(simulation.passportResponse).toContain('Directness: Challenge me hard');
    expect(simulation.passportResponse).toContain('Technical level: Intermediate');
    expect(simulation.passportResponse).toContain('Risk tolerance: Experimental');
  });

  it('keeps the generic side free of Passport-specific details', () => {
    const simulation = buildPassportSimulation(makePassport());

    expect(simulation.genericResponse).not.toContain('Kris');
    expect(simulation.genericResponse).not.toContain('United Kingdom');
    expect(simulation.genericResponse).not.toContain('British English');
    expect(simulation.genericResponse).not.toContain('Prefer small safe patches');
  });

  it('does not mutate the Passport object', () => {
    const passport = makePassport();
    const before = JSON.stringify(passport);

    buildPassportSimulation(passport);

    expect(JSON.stringify(passport)).toBe(before);
  });
});
