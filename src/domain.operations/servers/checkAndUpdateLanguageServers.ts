import Bottleneck from 'bottleneck';
import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { detectLanguageServerState } from './detectLanguageServerState';
import { disableLanguageServer } from './disableLanguageServer';
import { enableLanguageServer } from './enableLanguageServer';

// limiter ensures only one update runs at a time, debounced to 10s, max queue of 3
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 10_000, // 10 seconds between runs
  highWater: 1, // max queue size
  strategy: Bottleneck.strategy.OVERFLOW, // drop new requests when queue is full
});

/**
 * .what = checks all servers and enables/disables based on open editors
 * .why = core loop that maintains language servers in sync with open files
 */
export const checkAndUpdateLanguageServers = (context: {
  state: ExtensionState;
}): Promise<void> =>
  limiter.schedule(async () => {
    const config = vscode.workspace.getConfiguration('bhouncer');
    const enabled = config.get<boolean>('enabled', true);

    // skip if bhouncer is disabled
    if (!enabled) return;

    const servers = config.get<LanguageServerConfig[]>('servers', []);

    // evaluate each server against current open editors
    for (const serverConfig of servers) {
      // detect state before action
      const before = detectLanguageServerState(
        { config: serverConfig },
        context,
      );

      // skip if already in desired state
      if (before.desired === before.detected) continue;

      // apply state change
      try {
        // apply the change
        if (before.desired === 'live') {
          await enableLanguageServer({ config: serverConfig }, context);
        } else {
          await disableLanguageServer({ config: serverConfig }, context);
        }

        // detect state after action
        detectLanguageServerState({ config: serverConfig }, context);
      } catch (error) {
        context.state.output?.warn('checkAndUpdateLanguageServers.error', {
          key: serverConfig.settingKey,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
