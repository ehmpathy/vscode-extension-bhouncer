import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import type { ServerKillRecord } from '../../domain.objects/ServerKillRecord';
import { formatMemoryBytes } from '../output/formatMemoryBytes';
import { getProcessResources } from '../processes/getProcessResources';
import { killPidSafely } from '../processes/killPidSafely';
import { saveTrackedPids } from '../state/saveTrackedPids';
import { getServerRegistryEntry } from './getServerRegistryEntry';

/**
 * .what = disables a language server and kills its tracked pid
 * .why = frees memory via server stop when their files are no longer open
 */
export const disableLanguageServer = async (
  input: { config: LanguageServerConfig },
  context: { state: ExtensionState },
): Promise<void> => {
  const { config } = input;
  const registry = getServerRegistryEntry({ config });

  // capture tracked pid before disable
  const pidBefore = context.state.trackedPids.get(config.slug);

  // failfast if no pid to kill
  if (pidBefore === undefined) return;

  context.state.output?.debug('disableLanguageServer.input', {
    slug: config.slug,
    pid: pidBefore,
  });

  // capture resources BEFORE kill for benefit proof
  const resourcesBefore = getProcessResources({ pid: pidBefore });

  // call onPrune hook to disable the server
  await registry.onPrune({ vscode });

  // kill the tracked pid
  const { killed } = killPidSafely({ pid: pidBefore });
  const killResult = killed ? 'killed' : 'already_exited';
  context.state.trackedPids.delete(config.slug);

  // persist tracked pids to workspace state file
  saveTrackedPids(context);

  context.state.output?.debug('disableLanguageServer.output', {
    slug: config.slug,
    pid: pidBefore,
    result: killResult,
  });

  // record kill and emit ✨ benefit output if resources were captured
  if (resourcesBefore && killResult === 'killed' && pidBefore) {
    const memoryFreed = resourcesBefore.memoryBytes;
    const cpuFreed = resourcesBefore.cpuPercent;

    // record for aggregate totals
    const killRecord: ServerKillRecord = {
      slug: config.slug,
      pid: pidBefore,
      killedAt: new Date().toISOString(),
      resourcesBefore,
      memoryFreedBytes: memoryFreed,
      cpuFreedPercent: cpuFreed,
    };
    context.state.killRecords.push(killRecord);
    context.state.totalMemoryFreedBytes += memoryFreed;

    // ✨ sparkle-labeled benefit output
    context.state.output?.info('✨ server.killed', {
      slug: config.slug,
      pid: pidBefore,
      memoryFreed: formatMemoryBytes({ bytes: memoryFreed }),
      cpuFreed: `${cpuFreed.toFixed(1)}%`,
    });

    context.state.output?.info('✨ resources.freed', {
      memoryBefore: formatMemoryBytes({ bytes: resourcesBefore.memoryBytes }),
      memoryAfter: '0 B',
      memoryDelta: `+${formatMemoryBytes({ bytes: memoryFreed })}`,
      cpuBefore: `${resourcesBefore.cpuPercent.toFixed(1)}%`,
      cpuAfter: '0%',
    });
  }
};
