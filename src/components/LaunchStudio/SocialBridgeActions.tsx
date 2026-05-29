import {
  openSocialComposer,
  SOCIAL_BRIDGE_TARGETS,
  type SocialBridgePlatform,
} from '../../utils/socialBridge';

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
  return (
    <div className={`social-bridge-actions${disabled ? ' social-bridge-actions--disabled' : ''}`} aria-label="Social Bridge sharing options">
      <p>{disabled ? disabledReason ?? 'Add what changed recently before sharing.' : 'Preview before posting. Memephant never posts automatically.'}</p>
      <div>
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
  );
}

export default SocialBridgeActions;
