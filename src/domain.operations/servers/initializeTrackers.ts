import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { detectUntrackedServers } from './detectUntrackedServers';
import { disableUntrackedServers } from './disableUntrackedServers';

/**
 * .what = sets up trackers for all configured language servers on activation
 * .why = ensures bhouncer can manage all configured servers from a clean state
 */
export const initializeTrackers = async (context: {
  state: ExtensionState;
}): Promise<void> => {
  // resolve settings file path
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const settingsPath = workspaceFolder
    ? `${workspaceFolder.uri.fsPath}/.vscode/settings.json`
    : null;

  context.state.output?.debug('initializeTrackers.input', {
    settingsPath,
  });

  // detect any running servers that bhouncer is not tracking
  const { untrackedServers } = detectUntrackedServers(context);

  // if no untracked servers, we're good
  if (untrackedServers.length === 0) {
    context.state.output?.debug('initializeTrackers.output', {
      result: 'clean',
    });
    return;
  }

  // disable untracked servers so we can manage them after reload
  await disableUntrackedServers({ untrackedServers }, context);

  context.state.output?.debug('initializeTrackers.output', {
    result: 'disabled_untracked',
    servers: untrackedServers.map((s) => s.settingKey),
  });

  // prompt user to reload
  const action = await vscode.window.showWarningMessage(
    `bhouncer: found ${untrackedServers.length} running language server(s) that were started before bhouncer. ` +
      `they have been disabled. please reload to let bhouncer manage them.`,
    'Reload Window',
  );

  if (action === 'Reload Window') {
    // disable ALL configured servers before reload so bhouncer can start fresh
    const config = vscode.workspace.getConfiguration('bhouncer');
    const allServers = config.get<LanguageServerConfig[]>('servers', []);

    await disableUntrackedServers({ untrackedServers: allServers }, context);

    context.state.output?.debug('initializeTrackers.reload', {
      servers: allServers.map((s) => s.settingKey),
    });
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
};
