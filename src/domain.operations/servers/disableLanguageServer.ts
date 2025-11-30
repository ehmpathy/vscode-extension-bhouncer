import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { killPidSafely } from '../processes/killPidSafely';
import { saveTrackedPids } from '../state/saveTrackedPids';

/**
 * .what = disables a language server and kills its tracked pid
 * .why = frees memory by stopping servers when their files are no longer open
 */
export const disableLanguageServer = async (
  input: { config: LanguageServerConfig },
  context: { state: ExtensionState },
): Promise<void> => {
  const settings = vscode.workspace.getConfiguration();

  // capture tracked pid before disabling
  const pidBefore = context.state.trackedPids.get(input.config.settingKey) ?? null;
  context.state.output?.debug('disableLanguageServer.input', {
    key: input.config.settingKey,
    pid: pidBefore,
  });

  // disable the setting
  await settings.update(input.config.settingKey, false, vscode.ConfigurationTarget.Workspace);

  // kill the tracked pid if present
  let killResult: 'killed' | 'already_exited' | 'not_tracked' = 'not_tracked';
  if (pidBefore) {
    const { killed } = killPidSafely({ pid: pidBefore });
    killResult = killed ? 'killed' : 'already_exited';
    context.state.trackedPids.delete(input.config.settingKey);

    // persist tracked pids to workspace state file
    saveTrackedPids(context);
  }

  // log after state
  context.state.output?.debug('disableLanguageServer.output', {
    key: input.config.settingKey,
    pid: pidBefore,
    result: killResult,
  });
};
