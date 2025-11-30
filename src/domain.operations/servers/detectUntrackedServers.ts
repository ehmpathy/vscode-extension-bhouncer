import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { getPids } from '../processes/getPids';

/**
 * .what = detects running language servers that bhouncer is not tracking
 * .why = on activation, existing servers need to be disabled so bhouncer can manage them cleanly
 */
export const detectUntrackedServers = (context: {
  state: ExtensionState;
}): { untrackedServers: LanguageServerConfig[] } => {
  const config = vscode.workspace.getConfiguration('bhouncer');
  const servers = config.get<LanguageServerConfig[]>('servers', []);

  context.state.output?.debug('detectUntrackedServers.input', {
    servers: servers.map((s) => s.settingKey),
  });

  const untrackedServers: LanguageServerConfig[] = [];

  // get workspace settings to check if servers are already disabled
  const settings = vscode.workspace.getConfiguration();

  for (const serverConfig of servers) {
    // check if server has running processes
    const pids = getPids({ pattern: serverConfig.processPattern });

    // check if any pids are not tracked by bhouncer in memory
    const trackedPid = context.state.trackedPids.get(serverConfig.settingKey);
    const hasUntrackedPids =
      pids.size > 0 && (!trackedPid || !pids.has(String(trackedPid)));

    // check if workspace settings already has this server disabled (tracked via settings)
    const settingValue = settings.get<boolean>(serverConfig.settingKey);
    const isDisabledInSettings = settingValue === false;

    // log each server check
    // context.state.output?.debug('check server for tracker', {
    //   key: serverConfig.settingKey,
    //   pattern: serverConfig.processPattern,
    //   pids: [...pids],
    //   trackedPid: trackedPid ?? null,
    //   hasUntrackedPids,
    //   isDisabledInSettings,
    // });

    // only consider untracked if has running pids AND not already disabled in settings
    if (hasUntrackedPids && !isDisabledInSettings) {
      untrackedServers.push(serverConfig);
    }
  }

  context.state.output?.debug('detectUntrackedServers.output', {
    untracked: untrackedServers.map((s) => s.settingKey),
  });

  return { untrackedServers };
};
