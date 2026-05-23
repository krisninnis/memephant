// ─────────────────────────────────────────────────────────────────────────────
// Memephant — Passport Badge Button (sidebar entry)
//
// Shows the user's Passport tier stamp + a short identity label in the
// sidebar. Clicking the badge navigates to the full-page AI Passport view
// (projectStore.currentView = 'passport') — it no longer opens a cramped
// inline dropdown.
//
// Behaviour summary:
//  - If a passport exists      → click → setCurrentView('passport')
//  - If no passport exists yet → click → startPassportEdit() (opens flow)
//
// Stamp tier:
//  - Bronze: no configuration set (just the three calibration answers)
//  - Silver: configuration filled in
//  - Gold:   reserved for a future trusted/premium tier (asset exists)
//
// No silent cloud sync. No silent attachment. Identity-first, not project-state.
// ─────────────────────────────────────────────────────────────────────────────

import { usePassportStore } from "../usePassportStore";
import { useProjectStore } from "../../../store/projectStore";
import passportStampBronze from "../../../assets/passport/tiers/passport-stamp-bronze.png";
import passportStampSilver from "../../../assets/passport/tiers/passport-stamp-silver.png";
import "../passport.badge.css";

interface PassportBadgeButtonProps {
  /** Called after navigating, so mobile drawer / sidebar can close. */
  onNavigate?: () => void;
}

export function PassportBadgeButton({ onNavigate }: PassportBadgeButtonProps = {}) {
  const passport = usePassportStore((s) => s.passport);
  const startPassportEdit = usePassportStore((s) => s.startPassportEdit);
  const setCurrentView = useProjectStore((s) => s.setCurrentView);

  if (!passport) {
    return (
      <div className="passport-badge-root">
        <button
          type="button"
          className="passport-badge-btn"
          aria-label="Create AI Passport"
          onClick={() => {
            startPassportEdit();
            onNavigate?.();
          }}
          title="Create AI Passport"
        >
          <img
            className="passport-badge-btn__seal"
            src={passportStampBronze}
            alt=""
            aria-hidden="true"
          />

          <span className="passport-badge-btn__body">
            <span className="passport-badge-btn__label">
              Create AI Passport
            </span>
            <span className="passport-badge-btn__id">
              Set your AI working style
            </span>
          </span>

          <span className="passport-badge-btn__chevron" aria-hidden="true">
            +
          </span>
        </button>
      </div>
    );
  }

  const shortId = passport.id.split("-").slice(1, 3).join("-");
  const hasConfiguration = Boolean(passport.configuration);
  const sealImage = hasConfiguration
    ? passportStampSilver
    : passportStampBronze;

  const handleOpenPage = () => {
    setCurrentView("passport");
    onNavigate?.();
  };

  return (
    <div className="passport-badge-root">
      <button
        type="button"
        className="passport-badge-btn"
        aria-label="Open AI Passport"
        onClick={handleOpenPage}
        title="Open AI Passport"
      >
        <img
          className="passport-badge-btn__seal"
          src={sealImage}
          alt=""
          aria-hidden="true"
        />

        <span className="passport-badge-btn__body">
          <span className="passport-badge-btn__label">AI Passport</span>
          <span className="passport-badge-btn__id">{shortId}</span>
        </span>

        <span className="passport-badge-btn__chevron" aria-hidden="true">
          ›
        </span>
      </button>
    </div>
  );
}
