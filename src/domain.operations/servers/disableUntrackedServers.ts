import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { LANGUAGE_SERVER_REGISTRY } from '../../domain.objects/LanguageServerRegistry';
import { killPidSafely } from '../processes/killPidSafely';
import { getPids } from '../processes/getPids';

/**
 * .what = disables language servers that bhouncer cannot track
 * .why = prepares for reload so bhouncer can manage servers from a clean state
 */
export const disableUntrackedServers = async (
  input: { untrackedServers: LanguageServerConfig[] },
  context: { state: ExtensionState },
): Promise<void> => {
  for (const serverConfig of input.untrackedServers) {
    // lookup registry entry for this server
    const registry = LANGUAGE_SERVER_REGISTRY[serverConfig.slug];
    if (!registry) continue; // skip unknown servers

    try {
      // call onPrune hook to disable the server
      await registry.onPrune({ vscode });

      // kill all running processes for this server
      const pids = getPids({ pattern: serverConfig.processPattern });
      for (const pid of pids) {
        killPidSafely({ pid: parseInt(pid) });
      }

      context.state.output?.debug('disableUntrackedServer.output', {
        slug: serverConfig.slug,
        killedPids: [...pids],
      });
    } catch (error) {
      context.state.output?.warn('disableUntrackedServer.error', {
        slug: serverConfig.slug,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
