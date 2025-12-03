import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { killPidSafely } from '../processes/killPidSafely';

/**
 * .what = disables all configured language servers synchronously
 * .why = ensures servers are disabled on extension deactivation before window closes
 * .note = fire-and-forget the async settings.update since we're exiting anyway
 */
export const disableAllLanguageServers = (context: {
  state: ExtensionState;
}): { disabled: string[]; killed: string[] } => {
  const config = vscode.workspace.getConfiguration('bhouncer');
  const servers = config.get<LanguageServerConfig[]>('servers', []) ?? [];
  const settings = vscode.workspace.getConfiguration();

  const disabled: string[] = [];
  const killed: string[] = [];

  // disable each configured server
  for (const serverConfig of servers) {
    // fire-and-forget the setting update (async but we don't wait)
    settings.update(
      serverConfig.settingKey,
      false,
      vscode.ConfigurationTarget.Workspace,
    );
    disabled.push(serverConfig.settingKey);

    // kill tracked pid if present
    const pid = context.state.trackedPids.get(serverConfig.settingKey);
    if (pid) {
      const { killed: wasKilled } = killPidSafely({ pid });
      if (wasKilled) {
        killed.push(`${serverConfig.settingKey}:${pid}`);
      }
      context.state.trackedPids.delete(serverConfig.settingKey);
    }
  }

  return { disabled, killed };
};
