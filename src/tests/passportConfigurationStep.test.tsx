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
    passportFlowSkipped: false,
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

function clickNext(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

function goToRoleStep(): void {
  for (let index = 0; index < 8; index += 1) {
    clickNext();
  }
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

  it('first Passport screen lets users skip for now without creating a Passport', () => {
    render(<PassportFlow />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    const state = usePassportStore.getState();
    expect(state.passport).toBeNull();
    expect(state.passportFlowSkipped).toBe(true);
    expect(state.flowStep).toBe('welcome');
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
    expect(screen.getByRole('heading', { name: 'Preferred name' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 9')).toBeInTheDocument();
  });

  it('Back and Next move through the wizard one question at a time', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    expect(screen.getByRole('heading', { name: 'Preferred name' })).toBeInTheDocument();

    clickNext();
    expect(screen.getByRole('heading', { name: 'Region' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Preferred name' })).toBeInTheDocument();
  });

  it('selected option buttons can be deselected by clicking them again', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    clickNext();

    const regionButton = screen.getByRole('button', { name: 'United Kingdom' });
    expect(regionButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(regionButton);
    expect(regionButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Not set yet. You can leave this blank and continue.')).toBeInTheDocument();
  });

  it('entered values persist when navigating back and forward', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Preferred name' }), {
      target: { value: 'Kris' },
    });

    clickNext();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('textbox', { name: 'Preferred name' })).toHaveValue('Kris');
  });

  it('Skip for now generates a Passport with defaults', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    finishGeneration();

    const configuration = usePassportStore.getState().passport?.configuration;
    expect(configuration?.region).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.region);
    expect(configuration?.languagePreference).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.languagePreference);
    expect(configuration?.dateFormat).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.dateFormat);
    expect(configuration?.currency).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.currency);
    expect(configuration?.directness).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.directness);
    expect(configuration?.technicalLevel).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.technicalLevel);
    expect(configuration?.riskTolerance).toBe(DEFAULT_PASSPORT_CONFIGURATION_V2.riskTolerance);
    expect(configuration?.roleContext).toBe('');
  });

  it('Complete Passport saves selected wizard values', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Preferred name' }), {
      target: { value: 'Kris' },
    });

    goToRoleStep();
    fireEvent.click(screen.getByRole('button', { name: 'Solo founder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Passport' }));
    finishGeneration();

    const configuration = usePassportStore.getState().passport?.configuration;
    expect(configuration?.preferredName).toBe('Kris');
    expect(configuration?.region).toBe('United Kingdom');
    expect(configuration?.languagePreference).toBe('British English');
    expect(configuration?.roleContext).toBe('Solo founder');
  });

  it('does not show a date of birth field', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    expect(screen.queryByText(/date of birth/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/date of birth/i)).not.toBeInTheDocument();
  });

  it('Copy Passport includes role/context if selected', () => {
    setCompletedCalibrationDraft();
    render(<PassportFlow />);

    goToRoleStep();
    fireEvent.click(screen.getByRole('button', { name: 'Solo founder' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Passport' }));
    finishGeneration();

    const passport = usePassportStore.getState().passport;
    expect(passport).not.toBeNull();

    const attachment = buildPassportAttachmentPreview(passport!, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).toContain('Role/context: Solo founder');
  });
});
