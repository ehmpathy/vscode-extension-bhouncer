import { UnexpectedCodePathError } from 'helpful-errors';

import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import {
  LANGUAGE_SERVER_REGISTRY,
  type LanguageServerRegistryEntry,
} from '../../domain.objects/LanguageServerRegistry';

/**
 * .what = resolves the registry entry for a language server config
 * .why = enables operations to look up control details (mode, settingKey, restartCommand) by slug
 */
export const getServerRegistryEntry = (input: {
  config: LanguageServerConfig;
}): LanguageServerRegistryEntry => {
  const entry = LANGUAGE_SERVER_REGISTRY[input.config.slug];

  // fail fast if server slug is not in registry
  if (!entry) {
    throw new UnexpectedCodePathError(
      `unknown language server slug: ${input.config.slug}. add it to LANGUAGE_SERVER_REGISTRY`,
      { slug: input.config.slug },
    );
  }

  return entry;
};
