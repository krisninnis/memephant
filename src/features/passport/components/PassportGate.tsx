// ─────────────────────────────────────────────────────────────────────────────
// Memephant — Passport Gate
//
// Wraps the entire app. Three render cases:
//
//   1. NEW USER (hasSeenOnboarding = false, passport = null)
//      → Show PassportFlow (passport creation)
//
//   2. FLOW IN PROGRESS (flowStep = 'complete' — just generated)
//      → Still show PassportFlow so the user sees their passport card.
//        "Enter Memephant" resets flowStep → case 3.
//
//   3. EXISTING USER OR RETURNING USER (passport exists OR hasSeenOnboarding = true)
//      → Render children (the normal app, including OnboardingModal if unseen).
//
// This means existing users who already completed Memephant onboarding are
// NEVER shown the passport flow — they drop straight into the app.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { usePassportStore } from '../usePassportStore';
import { useProjectStore } from '../../../store/projectStore';
import { PassportFlow } from './PassportFlow';

interface PassportGateProps {
  children: React.ReactNode;
}

export function PassportGate({ children }: PassportGateProps) {
  const passport  = usePassportStore((s) => s.passport);
  const flowStep  = usePassportStore((s) => s.flowStep);

  // Existing users (already onboarded) bypass the passport flow entirely.
  // Their FrontalLobe profile and vault remain untouched.
  const hasSeenOnboarding = useProjectStore((s) => s.settings.general.hasSeenOnboarding);

  // Case 1: brand new user — no passport, never seen onboarding
  const isNewUser = !passport && !hasSeenOnboarding;

  // Case 2: user just generated their passport and is viewing the card
  const isViewingCard = flowStep === 'complete';

  const showFlow = isNewUser || isViewingCard;

  if (showFlow) {
    return <PassportFlow />;
  }

  return <>{children}</>;
}
