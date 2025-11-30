import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { getPids } from '../processes/getPids';
import { saveTrackedPids } from '../state/saveTrackedPids';

/**
 * .what = enables a language server and tracks its spawned pid
 * .why = implements lazy-load pattern by enabling servers only when needed
 */
export const enableLanguageServer = async (
  input: { config: LanguageServerConfig },
  context: { state: ExtensionState },
): Promise<void> => {
  const settings = vscode.workspace.getConfiguration();
  const currentValue = settings.get(input.config.settingKey);

  // skip if already enabled
  if (currentValue === true) return;

  // capture pids before enabling
  const pidsBefore = getPids({ pattern: input.config.processPattern });
  // context.state.output?.debug('enable language server', {
  //   key: input.config.settingKey,
  //   stage: 'before',
  //   pids: [...pidsBefore],
  // });

  // enable the language server
  await settings.update(input.config.settingKey, true, vscode.ConfigurationTarget.Workspace);

  // wait for server to spawn
  await new Promise((r) => setTimeout(r, 2000));

  // detect and track the new pid
  const pidsAfter = getPids({ pattern: input.config.processPattern });
  let pidTracked: string | null = null;
  for (const pid of pidsAfter) {
    if (!pidsBefore.has(pid)) {
      context.state.trackedPids.set(input.config.settingKey, parseInt(pid));
      pidTracked = pid;
      break;
    }
  }

  // persist tracked pids to workspace state file
  if (pidTracked) {
    saveTrackedPids(context);
  }

  // log after state
  context.state.output?.debug('enableLanguageServer.output', {
    key: input.config.settingKey,
    pid: pidTracked,
  });
};
