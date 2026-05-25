import { defaultPassportStyleSettings } from '../utils/passportStyleSettings';
import { applyPassportStyleSettings } from '../utils/passportStyleTransform';

describe('applyPassportStyleSettings', () => {
  it('keeps AI phrases unchanged when reduceAiPhrases is disabled', () => {
    const text = 'It is important to note that we can leverage a robust workflow.';

    expect(applyPassportStyleSettings(text, defaultPassportStyleSettings)).toBe(text);
  });

  it('reduces AI phrases when reduceAiPhrases is enabled', () => {
    const text = [
      "It's important to note that this seamless flow can leverage robust checks.",
      'We can delve into a game-changing way to streamline work moving forward.',
    ].join(' ');

    expect(applyPassportStyleSettings(text, {
      ...defaultPassportStyleSettings,
      reduceAiPhrases: true,
    })).toBe(
      'this smooth flow can use solid checks. We can look at a useful way to simplify work next.',
    );
  });

  it('replaces em dashes only when avoidEmDashes is enabled', () => {
    const text = 'Build locally\u2014then export safely.';

    expect(applyPassportStyleSettings(text, {
      ...defaultPassportStyleSettings,
      avoidEmDashes: true,
    })).toBe('Build locally - then export safely.');
  });

  it('leaves output unchanged when avoidEmDashes is disabled', () => {
    const text = 'Build locally\u2014then export safely.';

    expect(applyPassportStyleSettings(text, defaultPassportStyleSettings)).toBe(text);
  });

  it('applies em dash and AI phrase settings together', () => {
    const text = 'It is important to note that robust exports\u2014moving forward\u2014streamline handoff.';

    expect(applyPassportStyleSettings(text, {
      ...defaultPassportStyleSettings,
      avoidEmDashes: true,
      reduceAiPhrases: true,
    })).toBe('solid exports - next - simplify handoff.');
  });
});
