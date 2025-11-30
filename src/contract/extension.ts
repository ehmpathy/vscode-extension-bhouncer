import * as vscode from 'vscode';

import { createExtensionState, ExtensionState } from '../domain.objects/ExtensionState';
import { pruneEditors } from '../domain.operations/editors/pruneEditors';
import { createOutput } from '../domain.operations/output/createOutput';
import { killPidSafely } from '../domain.operations/processes/killPidSafely';
import { checkAndUpdateLanguageServers } from '../domain.operations/servers/checkAndUpdateLanguageServers';
import { initializeTrackers } from '../domain.operations/servers/initializeTrackers';
import { showStatus } from '../domain.operations/servers/showStatus';
import { loadTrackedPids } from '../domain.operations/state/loadTrackedPids';

// extension state instance
let state: ExtensionState = createExtensionState();

/**
 * .what = vscode extension activation entry point
 * .why = registers event handlers and starts the pruning interval
 */
export const activate = (vsContext: vscode.ExtensionContext): void => {
  // initialize fresh state
  state = createExtensionState();

  // check if output is enabled via settings (defaults to true)
  const outputEnabled = vscode.workspace
    .getConfiguration('bhouncer')
    .get('output.enabled', true);

  // create output
  state.output = createOutput({
    enabled: outputEnabled,
    createOutputChannel: vscode.window.createOutputChannel,
  });

  state.output.debug('activate.input', {});

  const context = { state };

  // load persisted tracked pids from workspace state file
  loadTrackedPids(context);

  // track editor access on focus change
  vsContext.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        state.editorLastAccess.set(editor.document.uri.toString(), Date.now());
      }
    }),
  );

  // check language servers and prune editors on tab changes
  vsContext.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs((event) => {
      // log opened tabs
      for (const tab of event.opened) {
        if (tab.input instanceof vscode.TabInputText) {
          state.output?.debug('onDidChangeTabs.opened', { path: tab.input.uri.fsPath });
        }
      }

      // log closed tabs
      for (const tab of event.closed) {
        if (tab.input instanceof vscode.TabInputText) {
          state.output?.debug('onDidChangeTabs.closed', { path: tab.input.uri.fsPath });
        }
      }

      checkAndUpdateLanguageServers(context);
      pruneEditors(context);
    }),
  );

  // register prune now command
  vsContext.subscriptions.push(
    vscode.commands.registerCommand('bhouncer.pruneNow', async () => {
      await pruneEditors(context);
      vscode.window.showInformationMessage('bhouncer: pruned stale editors');
    }),
  );

  // register status command
  vsContext.subscriptions.push(
    vscode.commands.registerCommand('bhouncer.showStatus', () => showStatus(context)),
  );

  // start periodic pruning interval
  state.pruneInterval = setInterval(() => pruneEditors(context), 60 * 1000);

  // track current active editor on startup
  if (vscode.window.activeTextEditor) {
    state.editorLastAccess.set(
      vscode.window.activeTextEditor.document.uri.toString(),
      Date.now(),
    );
  }

  // initialize trackers and check for untracked servers
  initializeTrackers(context).then(() => {
    // initial language server check after trackers are set up
    checkAndUpdateLanguageServers(context);
    state.output?.debug('activate.output', {});
  });
};

/**
 * .what = vscode extension deactivation cleanup
 * .why = ensures all tracked pids are killed and resources released
 */
export const deactivate = (): void => {
  state.output?.debug('deactivate.input', {});

  // stop periodic pruning
  if (state.pruneInterval) {
    clearInterval(state.pruneInterval);
  }

  // kill all tracked pids
  const killed: string[] = [];
  const exited: string[] = [];
  for (const [key, pid] of state.trackedPids) {
    const result = killPidSafely({ pid });
    if (result.killed) {
      killed.push(`${key}:${pid}`);
    } else {
      exited.push(`${key}:${pid}`);
    }
  }

  // clear state
  state.trackedPids.clear();
  state.editorLastAccess.clear();

  state.output?.debug('deactivate.output', {
    killed: killed.length > 0 ? killed : undefined,
    exited: exited.length > 0 ? exited : undefined,
  });

  // dispose output channel
  state.output?.dispose();
};
