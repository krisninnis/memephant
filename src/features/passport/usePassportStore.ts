// ─────────────────────────────────────────────────────────────────────────────
// Memephant — Passport Identity Store
//
// Independent Zustand store. Does NOT touch projectStore, PersonalMemoryVault,
// FrontalLobeProfile, or any cloud-synced data.
//
// Storage key: mph_passport_v1 (matches project naming convention).
// Cloud sync: NONE. This key is never read by cloudSync.ts or syncQueue.ts.
// Only `passport` (the completed record) is persisted. Flow state is ephemeral.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PassportStore, PassportFlowStep, PassportProfile } from './passport.types';
import { createPassportData } from './passport.utils';

/** Duration of the "generating" animation beat (ms). Intentional — do not remove. */
const GENERATION_DELAY_MS = 2000;

/** localStorage key. Never referenced by cloudSync.ts — local-only by design. */
export const PASSPORT_STORAGE_KEY = 'mph_passport_v1';

export const usePassportStore = create<PassportStore>()(
  persist(
    (set, get) => ({
      // ─── State ──────────────────────────────────────────────────────────────
      passport: null,
      flowStep: 'welcome',
      draft: {},
      isGenerating: false,

      // ─── Actions ────────────────────────────────────────────────────────────

      setFlowStep: (step: PassportFlowStep) => {
        set({ flowStep: step });
      },

      setDraftAnswer: (key, value) => {
        set((state) => ({
          draft: { ...state.draft, [key]: value },
        }));
      },

      generatePassport: () => {
        const { draft } = get();
        const profile = draft as PassportProfile;

        if (!profile.communicationStyle || !profile.tone || !profile.focusArea) {
          console.error('[PassportStore] generatePassport called with incomplete draft', draft);
          return;
        }

        set({ isGenerating: true, flowStep: 'generating' });

        // The 2-second pause is the emotional beat between answering and receiving.
        // It creates anticipation. Do not replace with instant state change.
        setTimeout(() => {
          const passport = createPassportData(profile);
          set({
            passport,
            draft: {},
            isGenerating: false,
            flowStep: 'complete',
          });
        }, GENERATION_DELAY_MS);
      },

      resetPassport: () => {
        set({
          passport: null,
          flowStep: 'welcome',
          draft: {},
          isGenerating: false,
        });
      },
    }),

    {
      name: PASSPORT_STORAGE_KEY,

      // Only persist the completed passport. Flow state + draft reset on every launch.
      // If a user closes the app mid-flow, they start fresh — intentional.
      partialize: (state) => ({
        passport: state.passport,
      }),
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────

/** True if a completed passport has been persisted. */
export const selectPassportExists = (s: PassportStore): boolean => s.passport !== null;

/** The completed passport data (null until the user finishes the flow). */
export const selectPassport = (s: PassportStore) => s.passport;

/** Current flow step. */
export const selectFlowStep = (s: PassportStore) => s.flowStep;
