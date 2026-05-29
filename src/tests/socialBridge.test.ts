import {
  buildSocialComposerUrl,
  openSocialComposer,
} from '../utils/socialBridge';

describe('socialBridge', () => {
  const content = 'Build update for Memephant:\nAdded Social Bridge composer links.';

  it('builds deterministic composer URLs for supported platforms', () => {
    expect(buildSocialComposerUrl('x', content))
      .toBe('https://twitter.com/intent/tweet?text=Build%20update%20for%20Memephant%3A%0AAdded%20Social%20Bridge%20composer%20links.');
    expect(buildSocialComposerUrl('linkedin', content))
      .toBe('https://www.linkedin.com/feed/?shareActive=true&text=Build%20update%20for%20Memephant%3A%0AAdded%20Social%20Bridge%20composer%20links.');
    expect(buildSocialComposerUrl('facebook', content))
      .toBe('https://www.facebook.com/sharer/sharer.php?quote=Build%20update%20for%20Memephant%3A%0AAdded%20Social%20Bridge%20composer%20links.');
    expect(buildSocialComposerUrl('reddit', content))
      .toBe('https://www.reddit.com/submit?title=Build%20update%20for%20Memephant%3A&text=Build%20update%20for%20Memephant%3A%0AAdded%20Social%20Bridge%20composer%20links.');
  });

  it('opens composer links only when explicitly called', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    openSocialComposer('x', content);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://twitter.com/intent/tweet?text='),
      '_blank',
      'noopener,noreferrer',
    );

    openSpy.mockRestore();
  });
});
