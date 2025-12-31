/**
 * .what = snapshot of a process's resource consumption
 * .why = enables before/after comparison to prove benefit of killing servers
 */
export interface ProcessResourceSnapshot {
  /** process id */
  pid: number;

  /** resident set size in bytes */
  memoryBytes: number;

  /** cpu usage percentage */
  cpuPercent: number;

  /** iso timestamp when snapshot was captured */
  capturedAt: string;
}
