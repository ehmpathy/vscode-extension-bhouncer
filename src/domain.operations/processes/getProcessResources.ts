import { execSync, type ExecSyncOptionsWithStringEncoding } from 'child_process';

import type { ProcessResourceSnapshot } from '../../domain.objects/ProcessResourceSnapshot';

/**
 * .what = retrieves memory and cpu usage for a pid via ps command
 * .why = enables before-kill resource measurement for benefit proof
 *
 * .note = returns null if pid not found (already exited)
 */
export const getProcessResources = (input: {
  pid: number;
}): ProcessResourceSnapshot | null => {
  try {
    // query ps for rss (kb) and cpu (%)
    const options: ExecSyncOptionsWithStringEncoding = { encoding: 'utf8' };
    const output = execSync(
      `ps -o rss=,pcpu= -p ${input.pid}`,
      options,
    ).trim();

    // parse output: "  12345   2.3" -> [rss, cpu]
    const parts = output.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;

    // parse rss (in KB) and convert to bytes
    const rssKb = parseInt(parts[0] ?? '0', 10);
    const memoryBytes = rssKb * 1024;

    // parse cpu percentage
    const cpuPercent = parseFloat(parts[1] ?? '0');

    return {
      pid: input.pid,
      memoryBytes,
      cpuPercent,
      capturedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    // ps exits with error when pid not found - this is expected
    const errObj = error as { status?: number };
    if (errObj?.status === 1) {
      return null;
    }

    // any other error should fail fast
    throw error;
  }
};
