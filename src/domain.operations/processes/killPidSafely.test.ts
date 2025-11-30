import { given, when, then } from 'test-fns';

import { killPidSafely } from './killPidSafely';

describe('killPidSafely', () => {
  given('a pid to kill', () => {
    when('process exists and can be killed', () => {
      then('returns killed: true', () => {
        // spawn a short-lived process to kill
        const { spawn } = require('child_process');
        const child = spawn('sleep', ['10']);
        const pid = child.pid;

        const result = killPidSafely({ pid });

        expect(result.killed).toBe(true);
      });
    });

    when('process does not exist (ESRCH)', () => {
      then('returns killed: false', () => {
        // use a pid that almost certainly doesn't exist
        const result = killPidSafely({ pid: 999999999 });

        expect(result.killed).toBe(false);
      });
    });

    when('error is not ESRCH (e.g., EPERM for pid 1)', () => {
      then('throws the error (fail fast)', () => {
        // pid 1 (init) is protected - killing it causes EPERM
        expect(() => killPidSafely({ pid: 1 })).toThrow();
      });
    });
  });
});
