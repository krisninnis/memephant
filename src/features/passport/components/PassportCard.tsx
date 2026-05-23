// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Memephant Passport â€” The Generated Passport Card
// This is the hero moment. Everything in the flow leads here.
// Design goal: screenshot-worthy, premium, unmistakably yours.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import React, { useEffect, useState } from "react";

import {
  COMMUNICATION_LABELS,
  TONE_LABELS,
  FOCUS_LABELS,
  formatPassportDate,
} from "../passport.utils";
import { PassportSeal } from "./PassportSeal";
import { usePassportStore } from "../usePassportStore";
import passportShieldIntegrity from "../../../assets/passport/hero/passport-shield-integrity.png";
import passportStampBronze from "../../../assets/passport/tiers/passport-stamp-bronze.png";
import passportStampGold from "../../../assets/passport/tiers/passport-stamp-gold.png";
import passportStampSilver from "../../../assets/passport/tiers/passport-stamp-silver.png";

const ELEPHANT_LOGO_SRC = "/icons/source-elephant-1024.png";

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STAGE: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#080c1a",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "24px",
  overflowX: "hidden",
  overflowY: "auto",
  padding: "32px 0",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  animation: "passport-fade-in 0.4s ease both",
};

const AMBIENT_1: React.CSSProperties = {
  position: "absolute",
  top: "-5%",
  right: "-10%",
  width: "700px",
  height: "500px",
  borderRadius: "50%",
  background:
    "radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 65%)",
  pointerEvents: "none",
  animation: "passport-ambient-pulse 8s ease-in-out infinite",
};

const AMBIENT_2: React.CSSProperties = {
  position: "absolute",
  bottom: "0",
  left: "-5%",
  width: "600px",
  height: "400px",
  borderRadius: "50%",
  background:
    "radial-gradient(ellipse, rgba(245,158,11,0.055) 0%, transparent 65%)",
  pointerEvents: "none",
  animation: "passport-ambient-pulse 10s ease-in-out infinite 3s",
};

const CARD: React.CSSProperties = {
  position: "relative",
  width: "calc(100% - 48px)",
  maxWidth: "600px",
  minHeight: "360px",
  borderRadius: "22px",
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(12, 16, 30, 0.96)",
  backdropFilter: "blur(20px)",
  overflow: "hidden",
  animation: "passport-slide-up 0.75s cubic-bezier(0.22, 1, 0.36, 1) both",
  boxShadow:
    "0 0 0 1px rgba(245,158,11,0.07) inset, 0 28px 90px rgba(0,0,0,0.64), 0 2px 0 rgba(255,255,255,0.04) inset",
  margin: "0 auto",
};

const CARD_OVERLAY: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(135deg, rgba(124,58,237,0.04) 0%, transparent 48%, rgba(245,158,11,0.045) 100%)",
  pointerEvents: "none",
};

const INTEGRITY_WATERMARK: React.CSSProperties = {
  position: "absolute",
  right: "-32px",
  bottom: "-42px",
  width: "190px",
  maxWidth: "42%",
  height: "auto",
  objectFit: "contain",
  opacity: 0.12,
  pointerEvents: "none",
  filter: "drop-shadow(0 0 42px rgba(56,189,248,0.2))",
};

const CARD_HEADER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  padding: "20px 24px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.055)",
};

const BRAND_BLOCK: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const BRAND_LOGO: React.CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "14px",
  objectFit: "contain",
  filter: "drop-shadow(0 0 14px rgba(245,158,11,0.2))",
};

const BRAND_TEXT: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const PASSPORT_WORDMARK: React.CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 800,
  letterSpacing: "0.2em",
  color: "rgba(245,158,11,0.68)",
  textTransform: "uppercase",
};

const PASSPORT_READY_TEXT: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "0.9rem",
  fontWeight: 700,
  letterSpacing: "-0.015em",
};

const PASSPORT_ID_CONTAINER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0,
};

const PASSPORT_ID_LABEL: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 600,
  letterSpacing: "0.18em",
  color: "rgba(255,255,255,0.18)",
  textTransform: "uppercase",
};

const CARD_BODY: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "128px 1fr",
  gap: 0,
  padding: "26px 26px 18px",
  alignItems: "start",
};

const SEAL_COLUMN: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "12px",
  paddingRight: "22px",
  borderRight: "1px solid rgba(255,255,255,0.055)",
  animation: "passport-section-in 0.6s ease both 0.35s",
};

const STAMP_ROW: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  justifyContent: "center",
  marginTop: "2px",
};

const STAMP_IMAGE_BASE: React.CSSProperties = {
  width: "30px",
  height: "30px",
  objectFit: "contain",
  transition: "filter 220ms ease, opacity 220ms ease, transform 220ms ease",
};

const FACETS_COLUMN: React.CSSProperties = {
  paddingLeft: "26px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

interface FacetRowProps {
  label: string;
  value: string;
  delay: number;
}

function FacetRow({ label, value, delay }: FacetRowProps) {
  return (
    <div
      style={{
        animation: `passport-section-in 0.5s ease both ${delay}ms`,
      }}
    >
      <div
        style={{
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(245,158,11,0.48)",
          textTransform: "uppercase",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#e2e8f0",
          letterSpacing: "-0.005em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AnimatedHash({
  hash,
  style,
}: {
  hash: string;
  style?: React.CSSProperties;
}) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= hash.length) clearInterval(interval);
    }, 38);

    return () => clearInterval(interval);
  }, [hash]);

  return (
    <span
      style={{
        fontFamily:
          '"SF Mono", "Fira Code", "Cascadia Code", "Consolas", monospace',
        fontSize: "12px",
        fontWeight: 500,
        letterSpacing: "0.12em",
        color: "rgba(245,158,11,0.75)",
        ...style,
      }}
      aria-label={`Passport ID: ${hash}`}
    >
      {hash.slice(0, revealed)}
      {revealed < hash.length && (
        <span
          style={{
            color: "rgba(245,158,11,0.3)",
            animation: "passport-dot-bounce 0.8s ease infinite",
          }}
        >
          _
        </span>
      )}
    </span>
  );
}

const CARD_FOOTER: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.055)",
  padding: "13px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  animation: "passport-section-in 0.5s ease both 0.65s",
};

const FOOTER_TAGS: React.CSSProperties = {
  display: "flex",
  gap: "14px",
  alignItems: "center",
  flexWrap: "wrap",
};

function FooterTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "9px",
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "rgba(255,255,255,0.24)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function FooterDot() {
  return (
    <span
      style={{
        width: "2px",
        height: "2px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.12)",
        display: "inline-block",
      }}
    />
  );
}

function ProgressStamp({
  src,
  alt,
  active,
}: {
  src: string;
  alt: string;
  active: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...STAMP_IMAGE_BASE,
        opacity: active ? 0.92 : 0.28,
        filter: active
          ? hovered
            ? "drop-shadow(0 0 18px rgba(245,158,11,0.3))"
            : "drop-shadow(0 0 10px rgba(245,158,11,0.18))"
          : "grayscale(0.35)",
        transform: hovered
          ? "translateY(-1px) scale(1.04)"
          : "translateY(0) scale(1)",
      }}
    />
  );
}

const IDENTITY_REVEAL: React.CSSProperties = {
  padding: "0 28px 20px",
  display: "flex",
  flexDirection: "column",
  gap: "0.7rem",
  animation: "passport-section-in 0.5s ease both 0.75s",
};

const REVEAL_TITLE: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "1rem",
  fontWeight: 800,
  letterSpacing: "-0.02em",
};

const REVEAL_COPY: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "0.84rem",
  lineHeight: 1.65,
  maxWidth: "470px",
};

const DONE_BUTTON_BASE: React.CSSProperties = {
  padding: "12px 28px",
  borderRadius: "12px",
  border: "1px solid rgba(245,158,11,0.28)",
  background: "rgba(245,158,11,0.08)",
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.01em",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.2s ease",
  animation: "passport-section-in 0.5s ease both 0.85s",
};

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PassportCard() {
  const passport = usePassportStore((s) => s.passport);
  const setFlowStep = usePassportStore((s) => s.setFlowStep);
  const [doneHovered, setDoneHovered] = useState(false);

  function handleEnter() {
    setFlowStep("preview");
  }

  if (!passport) return null;

  const { id, fingerprint, profile, createdAt } = passport;

  const doneStyle: React.CSSProperties = {
    ...DONE_BUTTON_BASE,
    borderColor: doneHovered ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.28)",
    background: doneHovered ? "rgba(245,158,11,0.14)" : "rgba(245,158,11,0.08)",
    boxShadow: doneHovered ? "0 0 24px rgba(245,158,11,0.12)" : "none",
    transform: doneHovered ? "translateY(-1px)" : "translateY(0)",
  };

  return (
    <div style={STAGE}>
      <div style={AMBIENT_1} />
      <div style={AMBIENT_2} />

      <div style={CARD}>
        <div style={CARD_OVERLAY} />

        <img
          src={passportShieldIntegrity}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={INTEGRITY_WATERMARK}
        />

        <div style={CARD_HEADER}>
          <div style={BRAND_BLOCK}>
            <img src={ELEPHANT_LOGO_SRC} alt="Memephant" style={BRAND_LOGO} />

            <div style={BRAND_TEXT}>
              <div style={PASSPORT_WORDMARK}>Memephant Passport</div>
              <div style={PASSPORT_READY_TEXT}>Your AI identity is ready</div>
            </div>
          </div>

          <div style={PASSPORT_ID_CONTAINER}>
            <span style={PASSPORT_ID_LABEL}>ID</span>
            <AnimatedHash hash={id} />
          </div>
        </div>

        <div style={CARD_BODY}>
          <div style={SEAL_COLUMN}>
            <PassportSeal fingerprint={fingerprint} size={84} />

            <div style={STAMP_ROW} aria-label="Passport progression">
              <ProgressStamp
                src={passportStampBronze}
                alt="Starter mark"
                active
              />
              <ProgressStamp
                src={passportStampSilver}
                alt="Calibrated mark"
                active
              />
              <ProgressStamp
                src={passportStampGold}
                alt="Trusted mark"
                active={false}
              />
            </div>

            <div
              style={{
                fontSize: "8.5px",
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: "rgba(245,158,11,0.38)",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              Calibrated
            </div>
          </div>

          <div style={FACETS_COLUMN}>
            <FacetRow
              label="Communication"
              value={COMMUNICATION_LABELS[profile.communicationStyle]}
              delay={200}
            />
            <FacetRow
              label="Tone"
              value={TONE_LABELS[profile.tone]}
              delay={300}
            />
            <FacetRow
              label="Focus"
              value={FOCUS_LABELS[profile.focusArea]}
              delay={400}
            />
          </div>
        </div>

        <div style={IDENTITY_REVEAL}>
          <div style={REVEAL_TITLE}>
            You shouldnâ€™t have to re-explain yourself every time.
          </div>

          <div style={REVEAL_COPY}>
            Your Passport helps AI tools understand how you think, communicate,
            and work â€” so every new conversation starts closer to you.
          </div>
        </div>

        <div style={CARD_FOOTER}>
          <div style={FOOTER_TAGS}>
            <FooterTag>Local-first</FooterTag>
            <FooterDot />
            <FooterTag>Integrity protected</FooterTag>
            <FooterDot />
            <FooterTag>AI-ready</FooterTag>
          </div>

          <span
            style={{
              fontSize: "9px",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.16)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatPassportDate(createdAt)}
          </span>
        </div>
      </div>

      <p
        style={{
          fontSize: "11px",
          color: "#64748b",
          letterSpacing: "0.02em",
          textAlign: "center",
          padding: "0 24px",
          animation: "passport-section-in 0.5s ease both 0.9s",
        }}
      >
        Stored locally on your device Â· Never shared without your consent
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
          width: "100%",
          maxWidth: "420px",
          padding: "0 24px 12px",
        }}
      >
        <button
          style={doneStyle}
          onMouseEnter={() => setDoneHovered(true)}
          onMouseLeave={() => setDoneHovered(false)}
          onFocus={() => setDoneHovered(true)}
          onBlur={() => setDoneHovered(false)}
          onClick={handleEnter}
        >
          See the difference â†’
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.5rem",
            color: "#64748b",
            fontSize: "0.74rem",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          <span>Next:</span>
          <span>Preview how your Passport changes AI responses.</span>
        </div>
      </div>
    </div>
  );
}
