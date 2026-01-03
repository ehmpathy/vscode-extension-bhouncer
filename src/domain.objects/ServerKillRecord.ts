import type { ProcessResourceSnapshot } from './ProcessResourceSnapshot';

/**
 * .what = record of a server kill with resource proof
 * .why = enables audit trail and aggregate benefit calculation
 */
export interface ServerKillRecord {
  /** language server slug (e.g., 'terraform', 'typescript') */
  slug: string;

  /** process id that was killed */
  pid: number;

  /** iso timestamp when server was killed */
  killedAt: string;

  /** resource snapshot captured before kill */
  resourcesBefore: ProcessResourceSnapshot;

  /** memory freed in bytes */
  memoryFreedBytes: number;

  /** cpu freed as percentage */
  cpuFreedPercent: number;
}
