import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { getPids } from '../processes/getPids';
import { saveTrackedPids } from '../state/saveTrackedPids';
import { getServerRegistryEntry } from './getServerRegistryEntry';

/**
 * .what = enables a language server and tracks its spawned pid
 * .why = implements lazy-load pattern via on-demand server start
 */
export const enableLanguageServer = async (
  input: { config: LanguageServerConfig },
  context: { state: ExtensionState },
): Promise<void> => {
  const { config } = input;
  const registry = getServerRegistryEntry({ config });

  // capture pids before start
  const pidsBefore = getPids({ pattern: registry.processPattern });

  // skip if server already live and tracked
  const trackedPid = context.state.trackedPids.get(config.slug);
  if (trackedPid && pidsBefore.has(String(trackedPid))) {
    return;
  }

  // call onStart hook to start the server
  await registry.onStart({ vscode });

  // wait for server to spawn
  await new Promise((r) => setTimeout(r, 2000));

  // detect and track the new pid
  const pidsAfter = getPids({ pattern: registry.processPattern });
  let pidTracked: string | null = null;
  for (const pid of pidsAfter) {
    if (!pidsBefore.has(pid)) {
      context.state.trackedPids.set(config.slug, parseInt(pid));
      pidTracked = pid;
      break;
    }
  }

  // if no new pid found, track any current pid (restart may reuse same process)
  if (!pidTracked && pidsAfter.size > 0) {
    const pidCurrent = [...pidsAfter][0];
    context.state.trackedPids.set(config.slug, parseInt(pidCurrent));
    pidTracked = pidCurrent;
  }

  // persist tracked pids to workspace state file
  if (pidTracked) {
    saveTrackedPids(context);
  }

  context.state.output?.debug('enableLanguageServer.output', {
    slug: config.slug,
    pid: pidTracked,
  });
};
