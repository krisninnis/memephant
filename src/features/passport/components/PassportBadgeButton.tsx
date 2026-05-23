// -----------------------------------------------------------------------------
// Memephant — Passport Badge Button (sidebar entry)
//
// Sidebar entry for the user's AI Passport.
// Clicking opens the full-page AI Passport view.
// This no longer opens an inline dropdown.
//
// Behaviour:
// - No Passport: starts Passport creation flow.
// - Existing Passport: navigates to the dedicated Passport page.
//
// Stamp tier:
// - Bronze: basic Passport created.
// - Silver: configured Passport.
// - Gold: reserved for future trusted/premium tier.
// -----------------------------------------------------------------------------

import { usePassportStore } from "../usePassportStore";
import { useProjectStore } from "../../../store/projectStore";
import passportStampBronze from "../../../assets/passport/tiers/passport-stamp-bronze.png";
import passportStampSilver from "../../../assets/passport/tiers/passport-stamp-silver.png";
import "../passport.badge.css";

interface PassportBadgeButtonProps {
  /** Called after navigating, so mobile drawer / sidebar can close. */
  onNavigate?: () => void;
}

export function PassportBadgeButton({
  onNavigate,
}: PassportBadgeButtonProps = {}) {
  const passport = usePassportStore((s) => s.passport);
  const startPassportEdit = usePassportStore((s) => s.startPassportEdit);
  const setCurrentView = useProjectStore((s) => s.setCurrentView);

  if (!passport) {
    return (
      <div className="passport-badge-root">
        <button
          type="button"
          className="passport-badge-btn passport-badge-btn--stacked"
          aria-label="Create AI Passport"
          onClick={() => {
            startPassportEdit();
            onNavigate?.();
          }}
          title="Create AI Passport"
        >
          <img
            className="passport-badge-btn__seal passport-badge-btn__seal--large"
            src={passportStampBronze}
            alt=""
            aria-hidden="true"
          />

          <span className="passport-badge-btn__body passport-badge-btn__body--centered">
            <span className="passport-badge-btn__label">
              Create AI Passport
            </span>
            <span className="passport-badge-btn__id">
              Set your AI working style
            </span>
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
        className="passport-badge-btn passport-badge-btn--stacked"
        aria-label="Open AI Passport"
        onClick={handleOpenPage}
        title="Open AI Passport"
      >
        <img
          className="passport-badge-btn__seal passport-badge-btn__seal--large"
          src={sealImage}
          alt=""
          aria-hidden="true"
        />

        <span className="passport-badge-btn__body passport-badge-btn__body--centered">
          <span className="passport-badge-btn__label">AI Passport</span>
          <span className="passport-badge-btn__id">{shortId}</span>
        </span>
      </button>
    </div>
  );
}
