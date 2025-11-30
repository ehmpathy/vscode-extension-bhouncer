import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';

/**
 * .what = saves tracked pids to workspace state file
 * .why = persists pid tracking across window reloads to maintain server management
 */
export const saveTrackedPids = (context: {
  state: ExtensionState;
}): void => {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    context.state.output?.debug('saveTrackedPids.output', {
      result: 'skipped',
      reason: 'no workspace folder',
    });
    return;
  }

  // state file location: .vscode/bhouncer.state.json
  const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
  const stateFilePath = path.join(vscodeDir, 'bhouncer.state.json');

  // ensure .vscode directory exists
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }

  // build state object
  const data = {
    trackedPids: Object.fromEntries(context.state.trackedPids),
  };

  // write state file
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify(data, null, 2), 'utf8');

    context.state.output?.debug('saveTrackedPids.output', {
      result: 'saved',
      count: context.state.trackedPids.size,
      path: stateFilePath,
    });
  } catch (error) {
    context.state.output?.warn('saveTrackedPids.error', {
      result: 'failed',
      reason: error instanceof Error ? error.message : String(error),
      path: stateFilePath,
    });
  }
};
