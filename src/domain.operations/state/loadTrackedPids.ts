import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import { isPidActive } from '../processes/isPidActive';

/**
 * .what = loads tracked pids from workspace state file
 * .why = restores pid tracking after window reload to avoid re-disabling servers
 */
export const loadTrackedPids = (context: {
  state: ExtensionState;
}): void => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    context.state.output?.debug('loadTrackedPids.output', {
      result: 'skipped',
      reason: 'no workspace folder',
    });
    return;
  }

  // state file location: .vscode/bhouncer.state.json
  const stateFilePath = path.join(
    workspaceFolder.uri.fsPath,
    '.vscode',
    'bhouncer.state.json',
  );

  // check if state file exists
  if (!fs.existsSync(stateFilePath)) {
    context.state.output?.debug('loadTrackedPids.output', {
      result: 'skipped',
      reason: 'no state file',
      path: stateFilePath,
    });
    return;
  }

  // read and parse state file
  try {
    const content = fs.readFileSync(stateFilePath, 'utf8');
    const data = JSON.parse(content) as { trackedPids?: Record<string, number> };

    // restore tracked pids, but only if they're still active
    const loadedPids: Record<string, number> = {};
    const staleKeys: string[] = [];

    if (data.trackedPids) {
      for (const [key, pid] of Object.entries(data.trackedPids)) {
        // verify pid is still running before tracking
        if (isPidActive({ pid })) {
          context.state.trackedPids.set(key, pid);
          loadedPids[key] = pid;
        } else {
          staleKeys.push(key);
        }
      }
    }

    context.state.output?.debug('loadTrackedPids.output', {
      result: 'loaded',
      count: context.state.trackedPids.size,
      pids: loadedPids,
      stale: staleKeys.length > 0 ? staleKeys : undefined,
    });
  } catch (error) {
    context.state.output?.warn('loadTrackedPids.error', {
      result: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      path: stateFilePath,
    });
  }
};
