import { given, when, then } from 'test-fns';

import { getProcessResources } from './getProcessResources';

describe('getProcessResources.integration', () => {
  given('the current process pid', () => {
    when('queried for resources', () => {
      then('returns valid snapshot with positive memory', () => {
        const result = getProcessResources({ pid: process.pid });

        expect(result).not.toBeNull();
        expect(result?.pid).toEqual(process.pid);
        expect(result?.memoryBytes).toBeGreaterThan(0);
        expect(result?.cpuPercent).toBeGreaterThanOrEqual(0);
        expect(result?.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });
  });

  given('a nonexistent pid', () => {
    when('queried for resources', () => {
      then('returns null', () => {
        // use an extremely high pid that almost certainly doesn't exist
        const result = getProcessResources({ pid: 999999999 });

        expect(result).toBeNull();
      });
    });
  });
});
