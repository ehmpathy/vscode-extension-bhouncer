import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { disableLanguageServer } from './disableLanguageServer';
import { enableLanguageServer } from './enableLanguageServer';

/**
 * .what = explicitly restarts a language server to capture its pid
 * .why = when server is live but untracked, we must kill and restart to get a tracked pid
 */
export const restartLanguageServer = async (
  input: { config: LanguageServerConfig },
  context: { state: ExtensionState },
): Promise<void> => {
  // kill the current server
  await disableLanguageServer(input, context);

  // start fresh and capture the new pid
  await enableLanguageServer(input, context);
};
