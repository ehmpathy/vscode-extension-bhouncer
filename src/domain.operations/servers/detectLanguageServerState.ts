import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { getOpenEditorsByExtension } from '../editors/getOpenEditorsByExtension';
import { getPids } from '../processes/getPids';
import { getServerRegistryEntry } from './getServerRegistryEntry';

/**
 * .what = detects and logs the current state of a language server
 * .why = provides visibility into language server state transitions
 */
export const detectLanguageServerState = (
  input: { config: LanguageServerConfig },
  context: { state: ExtensionState },
): { desired: 'live' | 'dead'; detected: 'live' | 'dead' } => {
  const { config } = input;
  const registry = getServerRegistryEntry({ config });

  // get editor counts for this server's extensions
  const editorCounts = getOpenEditorsByExtension({
    extensions: config.extensions,
  });

  // determine current detected state by check if process is live
  const pids = getPids({ pattern: registry.processPattern });
  const detected = pids.size > 0 ? 'live' : 'dead';

  // determine desired state based on open editors
  const totalEditors = Object.values(editorCounts).reduce((a, b) => a + b, 0);
  const desired = totalEditors > 0 ? 'live' : 'dead';

  // check if we have a tracked pid for this server
  const trackedPid = context.state.trackedPids.get(config.slug);

  // log when state change is needed AND we can take action
  // skip logging if desired=dead but we have no pid to kill (nothing actionable)
  const canTakeAction = desired === 'live' || trackedPid !== undefined;
  if (desired !== detected && canTakeAction) {
    context.state.output?.debug('detectLanguageServerState.output onDiff', {
      slug: config.slug,
      desired,
      detected,
      editors: editorCounts,
    });
  }

  return { desired, detected };
};
