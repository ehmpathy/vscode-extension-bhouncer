import type { BouncePolicy } from '../../domain.objects/BouncePolicy';

/**
 * .what = returns the default bounceOnByExtension config
 * .why = centralizes default policy for .md files (TABS_LIMIT only)
 */
export const getDefaultBounceConfig = (): Record<string, BouncePolicy> => ({
  '.md': 'TABS_LIMIT',
  '.markdown': 'TABS_LIMIT',
});
