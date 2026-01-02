import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { LANGUAGE_SERVER_REGISTRY } from '../../domain.objects/LanguageServerRegistry';
import { getPids } from '../processes/getPids';

/**
 * .what = detects live language servers that bhouncer has not tracked
 * .why = on activation, prior servers need to be disabled so bhouncer can manage them cleanly
 */
export const detectUntrackedServers = (context: {
  state: ExtensionState;
}): { untrackedServers: LanguageServerConfig[] } => {
  const config = vscode.workspace.getConfiguration('bhouncer');
  const servers = config.get<LanguageServerConfig[]>('servers', []);

  context.state.output?.debug('detectUntrackedServers.input', {
    servers: servers.map((s) => s.slug),
  });

  const untrackedServers: LanguageServerConfig[] = [];

  for (const serverConfig of servers) {
    // lookup registry entry for this server
    const registry = LANGUAGE_SERVER_REGISTRY[serverConfig.slug];
    if (!registry) continue; // skip unknown servers

    // check if server has live processes
    const pids = getPids({ pattern: registry.processPattern });

    // check if any pids are not tracked by bhouncer in memory
    const trackedPid = context.state.trackedPids.get(serverConfig.slug);
    const hasUntrackedPids =
      pids.size > 0 && (!trackedPid || !pids.has(String(trackedPid)));

    // if has live pids that we have not tracked, it's untracked
    if (hasUntrackedPids) {
      untrackedServers.push(serverConfig);
    }
  }

  context.state.output?.debug('detectUntrackedServers.output', {
    untracked: untrackedServers.map((s) => s.slug),
  });

  return { untrackedServers };
};
