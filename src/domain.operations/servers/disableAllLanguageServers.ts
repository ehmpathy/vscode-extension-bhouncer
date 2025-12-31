import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { LANGUAGE_SERVER_REGISTRY } from '../../domain.objects/LanguageServerRegistry';
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
    // lookup registry entry for this server
    const registry = LANGUAGE_SERVER_REGISTRY[serverConfig.slug];
    if (!registry) continue; // skip unknown servers

    // for setting-based servers, fire-and-forget the setting update
    if (registry.mode === 'setting' && registry.settingKey) {
      settings.update(
        registry.settingKey,
        false,
        vscode.ConfigurationTarget.Workspace,
      );
      disabled.push(serverConfig.slug);
    }

    // kill tracked pid if present (applies to both modes)
    const pid = context.state.trackedPids.get(serverConfig.slug);
    if (pid) {
      const { killed: wasKilled } = killPidSafely({ pid });
      if (wasKilled) {
        killed.push(`${serverConfig.slug}:${pid}`);
      }
      context.state.trackedPids.delete(serverConfig.slug);
    }
  }

  return { disabled, killed };
};
