import type { Output } from '../domain.operations/output/createOutput';

/**
 * .what = extension state container
 * .why = encapsulates mutable state to avoid module-level globals and enable testing
 */
export interface ExtensionState {
  /** tracked pids per language server setting key */
  trackedPids: Map<string, number>;

  /** last access time per editor uri */
  editorLastAccess: Map<string, number>;

  /** interval handle for periodic pruning */
  pruneInterval: NodeJS.Timeout | undefined;

  /** output instance for logging */
  output: Output | undefined;
}

/**
 * .what = creates fresh extension state
 * .why = enables clean initialization and testing isolation
 */
export const createExtensionState = (): ExtensionState => ({
  trackedPids: new Map(),
  editorLastAccess: new Map(),
  pruneInterval: undefined,
  output: undefined,
});
