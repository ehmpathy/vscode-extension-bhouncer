import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import { formatMemoryBytes } from '../output/formatMemoryBytes';

/**
 * .what = displays current bhouncer status in a modal
 * .why = enables users to debug and verify bhouncer state
 */
export const showStatus = (context: { state: ExtensionState }): void => {
  const config = vscode.workspace.getConfiguration('bhouncer');
  const enabled = config.get<boolean>('enabled', true);

  // build status lines
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

  // add ✨ session benefits section if we have any kills
  if (context.state.killRecords.length > 0) {
    statusLines.push('');
    statusLines.push('✨ session benefits:');
    statusLines.push(
      `  servers killed: ${context.state.killRecords.length}`,
    );
    statusLines.push(
      `  memory freed: ${formatMemoryBytes({ bytes: context.state.totalMemoryFreedBytes })}`,
    );
  }

  vscode.window.showInformationMessage(statusLines.join('\n'), { modal: true });
};
