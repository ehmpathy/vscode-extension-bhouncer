import type { ExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { getOpenEditorsByExtension } from '../editors/getOpenEditorsByExtension';
import { getPids } from '../processes/getPids';

/**
 * .what = detects and logs the current state of a language server
 * .why = provides visibility into language server state transitions
 */
export const detectLanguageServerState = (
  input: { config: LanguageServerConfig },
  context: { state: ExtensionState },
): { desired: 'live' | 'dead'; detected: 'live' | 'dead' } => {
  const { config } = input;

  // get editor counts for this server's extensions
  const editorCounts = getOpenEditorsByExtension({
    extensions: config.extensions,
  });

  // determine current detected state by checking if process is running
  const pids = getPids({ pattern: config.processPattern });
  const detected = pids.size > 0 ? 'live' : 'dead';

  // determine desired state based on open editors
  const totalEditors = Object.values(editorCounts).reduce((a, b) => a + b, 0);
  const desired = totalEditors > 0 ? 'live' : 'dead';

  // log when state change is needed
  if (desired !== detected) {
    context.state.output?.debug('detectLanguageServerState.output onDiff', {
      slug: config.slug,
      desired,
      detected,
      editors: editorCounts,
    });
  }

  return { desired, detected };
};
