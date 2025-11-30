import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { getOpenEditorsByExtension } from '../editors/getOpenEditorsByExtension';

/**
 * .what = detects and logs the current state of a language server
 * .why = provides visibility into language server state transitions
 */
export const detectLanguageServerState = (
  input: { config: LanguageServerConfig },
  context: { state: ExtensionState },
): { desired: 'live' | 'dead'; detected: 'live' | 'dead' } => {
  // get editor counts for this server's extensions
  const editorCounts = getOpenEditorsByExtension({
    extensions: input.config.extensions,
  });

  // determine current setting state
  const settings = vscode.workspace.getConfiguration();
  const currentValue = settings.get(input.config.settingKey);
  const detected = currentValue === true ? 'live' : 'dead';

  // determine desired state based on open editors
  const totalEditors = Object.values(editorCounts).reduce((a, b) => a + b, 0);
  const desired = totalEditors > 0 ? 'live' : 'dead';

  // log when state change is needed
  if (desired !== detected) {
    context.state.output?.debug('detectLanguageServerState.output onDiff', {
      key: input.config.settingKey,
      desired,
      detected,
      editors: editorCounts,
    });
  }

  return { desired, detected };
};
