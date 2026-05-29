export type SocialBridgePlatform = 'x' | 'linkedin' | 'facebook' | 'reddit';

export type SocialBridgeTarget = {
  id: SocialBridgePlatform;
  label: string;
};

export const SOCIAL_BRIDGE_TARGETS: SocialBridgeTarget[] = [
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'reddit', label: 'Reddit' },
];

function firstContentLine(content: string): string {
  return content.split('\n').map((line) => line.trim()).find(Boolean) ?? 'Memephant update';
}

export function buildSocialComposerUrl(
  platform: SocialBridgePlatform,
  content: string,
): string {
  const text = content.trim();
  const encodedText = encodeURIComponent(text);
  const encodedTitle = encodeURIComponent(firstContentLine(text));

  if (platform === 'x') {
    return `https://twitter.com/intent/tweet?text=${encodedText}`;
  }

  if (platform === 'linkedin') {
    return `https://www.linkedin.com/feed/?shareActive=true&text=${encodedText}`;
  }

  if (platform === 'facebook') {
    return `https://www.facebook.com/sharer/sharer.php?quote=${encodedText}`;
  }

  return `https://www.reddit.com/submit?title=${encodedTitle}&text=${encodedText}`;
}

export function openSocialComposer(
  platform: SocialBridgePlatform,
  content: string,
): void {
  const url = buildSocialComposerUrl(platform, content);
  window.open(url, '_blank', 'noopener,noreferrer');
}
