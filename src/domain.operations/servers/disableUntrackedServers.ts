import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';

/**
 * .what = disables language servers that bhouncer cannot track
 * .why = prepares for reload so bhouncer can manage servers from a clean state
 */
export const disableUntrackedServers = async (
  input: { untrackedServers: LanguageServerConfig[] },
  context: { state: ExtensionState },
): Promise<void> => {
  const settings = vscode.workspace.getConfiguration();

  for (const serverConfig of input.untrackedServers) {
    const currentValue = settings.get(serverConfig.settingKey);

    // disable the setting
    try {
      await settings.update(
        serverConfig.settingKey,
        false,
        vscode.ConfigurationTarget.Workspace,
      );

      context.state.output?.debug('disableUntrackedServer.output', {
        key: serverConfig.settingKey,
        before: currentValue,
        after: false,
      });
    } catch (error) {
      context.state.output?.warn('disableUntrackedServer.error', {
        key: serverConfig.settingKey,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
