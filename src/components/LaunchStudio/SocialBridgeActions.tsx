import { useEffect, useRef, useState } from 'react';
import {
  openSocialComposer,
  SOCIAL_BRIDGE_TARGETS,
  type SocialBridgePlatform,
} from '../../utils/socialBridge';
import { copyExportToClipboard } from '../../services/tauriActions';

interface SocialBridgeActionsProps {
  content: string;
  disabled?: boolean;
  disabledReason?: string;
}

const PLATFORM_LABELS: Record<SocialBridgePlatform, string> = {
  x: 'Open in X',
  linkedin: 'Open in LinkedIn',
  facebook: 'Open in Facebook',
  reddit: 'Open in Reddit',
};

export function SocialBridgeActions({ content, disabled = false, disabledReason }: SocialBridgeActionsProps) {
  const [copied, setCopied] = useState(false);
  const copyResetTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (copyResetTimeoutRef.current !== undefined) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
  }, []);

  const handleCopy = async () => {
    try {
      await copyExportToClipboard(content, 'social-copy');
      setCopied(true);
      if (copyResetTimeoutRef.current !== undefined) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`social-bridge-actions${disabled ? ' social-bridge-actions--disabled' : ''}`} aria-label="Social Bridge sharing options">
      <p className="social-bridge-actions__note">
        {disabled ? disabledReason ?? 'Add what changed recently before sharing.' : 'Preview before posting. Memephant never posts automatically.'}
      </p>
      <div className="social-bridge-actions__controls">
        <button
          type="button"
          className="social-bridge-copy-btn"
          onClick={() => void handleCopy()}
          disabled={disabled}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <div className="social-bridge-btns">
          {SOCIAL_BRIDGE_TARGETS.map((target) => (
            <button
              type="button"
              key={target.id}
              disabled={disabled}
              onClick={() => openSocialComposer(target.id, content)}
            >
              {PLATFORM_LABELS[target.id]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SocialBridgeActions;
