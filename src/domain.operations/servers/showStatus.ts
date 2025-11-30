import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';

/**
 * .what = displays current bhouncer status in a modal
 * .why = enables users to debug and verify bhouncer state
 */
export const showStatus = (context: { state: ExtensionState }): void => {
  const config = vscode.workspace.getConfiguration('bhouncer');
  const enabled = config.get<boolean>('enabled', true);

  const statusLines = [
    `bhouncer: ${enabled ? 'enabled' : 'disabled'}`,
    `tracked editors: ${context.state.editorLastAccess.size}`,
    `active language servers: ${context.state.trackedPids.size}`,
    '',
    'tracked pids:',
    ...Array.from(context.state.trackedPids.entries()).map(
      ([key, pid]) => `  ${key}: ${pid}`,
    ),
  ];

  vscode.window.showInformationMessage(statusLines.join('\n'), { modal: true });
};
