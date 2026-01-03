/**
 * .what = kills a process by pid, covers the case where it already exited
 * .why = process.kill throws ESRCH when pid doesn't exist, which is expected during cleanup
 *
 * .note = only ESRCH is caught; all other errors propagate (fail fast)
 * .note = uses duck typing for error check because instanceof can fail across realms (e.g., swc/jest)
 */
export const killPidSafely = (input: { pid: number }): { killed: boolean } => {
  try {
    process.kill(input.pid);
    return { killed: true };
  } catch (error: unknown) {
    const errObj = error as { code?: string };
    const isNoSuchProcess = errObj?.code === 'ESRCH';
    if (isNoSuchProcess) return { killed: false };
    throw error;
  }
};
