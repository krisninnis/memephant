import { act, fireEvent, render, screen } from '@testing-library/react';
import { PassportFlow } from '../features/passport/components/PassportFlow';
import { usePassportStore } from '../features/passport/usePassportStore';
import { buildPassportAttachmentPreview } from '../features/passport/passportAttachment';
import { DEFAULT_PASSPORT_CONFIGURATION_V2 } from '../features/passport/passport.types';
import { DEFAULT_FRONTAL_LOBE_PROFILE } from '../types/personalMemoryVault';

function resetStore(): void {
  usePassportStore.setState({
    passport: null,
    flowStep: 'welcome',
    draft: {},
    isGenerating: false,
    isReeditingPassport: false,
  });
  localStorage.clear();
}

function setCompletedCalibrationDraft(): void {
  usePassportStore.setState({
    flowStep: 'configure',
    draft: {
      communicationStyle: 'structured',
      tone: 'friendly',
      focusArea: 'startup',
    },
  });
}

function finishGeneration(): void {
  act(() => {
    jest.advanceTimersByTime(2000);
  });
}

describe('Passport Configuration setup step', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStore();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('first-time Passport flow shows Complete your Passport after 3 questions', () => {
    usePassportStore.setState({
      flowStep: 'q3',
      draft: {
        communicationStyle: 'structured',
        tone: 'friendly',
      },
    });

    render(<PassportFlow />);
    fireEvent.click(screen.getByRole('radio', { name: 'Startup' }));

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.getByRole('heading', { name: 'Complete your Passport' })).toBeInTheDocument();
    expect(screen.getByText('Add the details AI tools need to work with you properly.')).toBeInTheDocument();
  });

  it('saves preferred name and region before generating the Passport card', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    fireEvent.change(screen.getByLabelText('Preferred name'), {
      target: { value: 'Kris' },
    });
    fireEvent.change(screen.getByLabelText('Region'), {
      target: { value: 'United Kingdom' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Complete Passport' }));

    expect(usePassportStore.getState().flowStep).toBe('generating');
    finishGeneration();

    const passport = usePassportStore.getState().passport;
    expect(passport?.configuration?.preferredName).toBe('Kris');
    expect(passport?.configuration?.region).toBe('United Kingdom');
    expect(usePassportStore.getState().flowStep).toBe('complete');
  });

  it('Skip for now keeps the default Passport configuration', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    finishGeneration();

    const configuration = usePassportStore.getState().passport?.configuration;
    expect(configuration?.region).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.region);
    expect(configuration?.dateFormat).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.dateFormat);
    expect(configuration?.currency).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.currency);
    expect(configuration?.directness).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.directness);
    expect(configuration?.technicalLevel).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.technicalLevel);
    expect(configuration?.riskTolerance).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.riskTolerance);
  });

  it('Copy Passport includes preferred name and region after setup configuration', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    fireEvent.change(screen.getByLabelText('Preferred name'), {
      target: { value: 'Kris' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Complete Passport' }));
    finishGeneration();

    const passport = usePassportStore.getState().passport;
    expect(passport).not.toBeNull();

    const attachment = buildPassportAttachmentPreview(passport!, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).toContain('Preferred name: Kris');
    expect(attachment.text).toContain('Region: United Kingdom');
  });
});
