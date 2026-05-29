import {
  openSocialComposer,
  SOCIAL_BRIDGE_TARGETS,
  type SocialBridgePlatform,
} from '../../utils/socialBridge';

interface SocialBridgeActionsProps {
  content: string;
}

const PLATFORM_LABELS: Record<SocialBridgePlatform, string> = {
  x: 'Open in X',
  linkedin: 'Open in LinkedIn',
  facebook: 'Open in Facebook',
  reddit: 'Open in Reddit',
};

export function SocialBridgeActions({ content }: SocialBridgeActionsProps) {
  return (
    <div className="social-bridge-actions" aria-label="Social Bridge sharing options">
      <p>Preview before posting. Memephant never posts automatically.</p>
      <div>
        {SOCIAL_BRIDGE_TARGETS.map((target) => (
          <button
            type="button"
            key={target.id}
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
