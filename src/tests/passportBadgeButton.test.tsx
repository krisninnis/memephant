import { fireEvent, render, screen, within } from '@testing-library/react';
import { PassportBadgeButton } from '../features/passport/components/PassportBadgeButton';
import { usePassportStore } from '../features/passport/usePassportStore';
import { createPassportData } from '../features/passport/passport.utils';
import type { PassportProfile } from '../features/passport/passport.types';

const FULL_PROFILE: PassportProfile = {
  communicationStyle: 'structured',
  tone: 'professional',
  focusArea: 'startup',
};

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

describe('PassportBadgeButton configuration UI', () => {
  beforeEach(resetStore);

  it('existing users can still create Passport from the sidebar CTA', () => {
    render(<PassportBadgeButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Create AI Passport' }));

    expect(usePassportStore.getState().isReeditingPassport).toBe(true);
    expect(usePassportStore.getState().flowStep).toBe('welcome');
  });

  it('existing users can configure Passport after creation', () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });
    render(<PassportBadgeButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Open AI Passport' }));
    const dialog = screen.getByRole('dialog', { name: 'Your AI Passport' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Configure Passport' }));
    fireEvent.change(within(dialog).getByLabelText('Preferred name'), {
      target: { value: 'Kris' },
    });
    fireEvent.change(within(dialog).getByLabelText('Role / working context'), {
      target: { value: 'Solo founder' },
    });
    fireEvent.change(within(dialog).getByLabelText('Language preference'), {
      target: { value: 'British English' },
    });
    fireEvent.change(within(dialog).getByLabelText('Directness'), {
      target: { value: 'Direct when risk is high' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Passport' }));

    expect(usePassportStore.getState().passport?.configuration?.preferredName).toBe('Kris');
    expect(usePassportStore.getState().passport?.configuration?.roleContext).toBe('Solo founder');
    expect(usePassportStore.getState().passport?.configuration?.languagePreference).toBe('British English');
    expect(usePassportStore.getState().passport?.configuration?.directness).toBe('Direct when risk is high');
    expect(within(dialog).getByRole('button', { name: 'Configure Passport' })).toBeInTheDocument();
  });
});
