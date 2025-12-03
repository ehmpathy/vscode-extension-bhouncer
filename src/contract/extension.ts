import * as vscode from 'vscode';

import { createExtensionState, ExtensionState } from '../domain.objects/ExtensionState';
import { pruneEditors } from '../domain.operations/editors/pruneEditors';
import { createOutput } from '../domain.operations/output/createOutput';
import { checkAndUpdateLanguageServers } from '../domain.operations/servers/checkAndUpdateLanguageServers';
import { disableAllLanguageServers } from '../domain.operations/servers/disableAllLanguageServers';
import { initializeTrackers } from '../domain.operations/servers/initializeTrackers';
import { showStatus } from '../domain.operations/servers/showStatus';
import { loadTrackedPids } from '../domain.operations/state/loadTrackedPids';
import { saveTrackedPids } from '../domain.operations/state/saveTrackedPids';

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
      // track opened tabs as freshly accessed (prevents immediate re-close)
      for (const tab of event.opened) {
        if (tab.input instanceof vscode.TabInputText) {
          const uri = tab.input.uri.toString();
          state.editorLastAccess.set(uri, Date.now());
          state.output?.debug('onDidChangeTabs.opened', { path: tab.input.uri.fsPath });
        }
      }

      // clean up closed tabs from access tracking
      for (const tab of event.closed) {
        if (tab.input instanceof vscode.TabInputText) {
          const uri = tab.input.uri.toString();
          state.editorLastAccess.delete(uri);
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
 * .why = ensures all language servers are disabled and resources released before window closes
 */
export const deactivate = (): void => {
  state.output?.debug('deactivate.input', {});

  // stop periodic pruning
  if (state.pruneInterval) {
    clearInterval(state.pruneInterval);
  }

  // disable all language servers and kill their pids
  const { disabled, killed } = disableAllLanguageServers({ state });

  // save state file before clearing (sync write maximizes success on shutdown)
  saveTrackedPids({ state });

  // clear state
  state.trackedPids.clear();
  state.editorLastAccess.clear();

  state.output?.debug('deactivate.output', {
    disabled: disabled.length > 0 ? disabled : undefined,
    killed: killed.length > 0 ? killed : undefined,
  });

  // dispose output channel
  state.output?.dispose();
};
