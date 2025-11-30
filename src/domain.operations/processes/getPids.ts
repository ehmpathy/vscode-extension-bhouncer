import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';

/**
 * .what = retrieves process ids matching a pattern via pgrep
 * .why = enables before/after diffing to identify newly spawned language server pids
 *
 * .note = pgrep exits with code 1 when no processes match (not an error)
 */
export const getPids = (input: { pattern: string }): Set<string> => {
  try {
    // query pgrep for matching processes
    const options: ExecSyncOptionsWithStringEncoding = { encoding: 'utf8' };
    const output = execSync(`pgrep -f "${input.pattern}"`, options);

    // parse output into set of pid strings
    return new Set(output.trim().split('\n').filter(Boolean));
  } catch (error: unknown) {
    // pgrep exits with code 1 when no processes match - this is expected behavior
    // note: use duck typing because instanceof Error fails across realms (swc/jest issue)
    const errObj = error as { status?: number };
    if (errObj?.status === 1) {
      return new Set();
    }

    // any other error should fail fast
    throw error;
  }
};
