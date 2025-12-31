import type { BouncePolicy } from '../../domain.objects/BouncePolicy';
import { getExtension } from './getExtension';

/**
 * .what = resolves bounce policy for a file based on extension
 * .why = enables per-extension closure rules with sensible defaults
 */
export const getBouncePolicy = (input: {
  uri: string;
  config: Record<string, BouncePolicy>;
}): BouncePolicy => {
  // extract extension from uri
  const ext = getExtension({ uri: input.uri });

  // return configured policy or default to BOTH
  return input.config[ext] ?? 'BOTH';
};
