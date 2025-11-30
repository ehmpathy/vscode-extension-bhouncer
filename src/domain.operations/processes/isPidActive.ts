/**
 * .what = checks if a process is still running by pid
 * .why = allows verifying persisted pids are still valid before tracking them
 *
 * .note = uses signal 0 which checks existence without sending a real signal
 */
export const isPidActive = (input: { pid: number }): boolean => {
  try {
    // signal 0 checks if process exists without actually signaling it
    process.kill(input.pid, 0);
    return true;
  } catch (error: unknown) {
    // ESRCH means process doesn't exist
    const errObj = error as { code?: string };
    if (errObj?.code === 'ESRCH') return false;

    // EPERM means process exists but we don't have permission (still active)
    if (errObj?.code === 'EPERM') return true;

    throw error;
  }
};
