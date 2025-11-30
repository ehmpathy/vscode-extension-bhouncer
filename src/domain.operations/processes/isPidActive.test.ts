import { given, when, then } from 'test-fns';

import { isPidActive } from './isPidActive';

describe('isPidActive', () => {
  given('a pid', () => {
    when('process is running (current process)', () => {
      then('returns true', () => {
        // use current process pid which is guaranteed to exist
        const result = isPidActive({ pid: process.pid });
        expect(result).toBe(true);
      });
    });

    when('process does not exist', () => {
      then('returns false', () => {
        // use a very high pid that almost certainly doesn't exist
        const result = isPidActive({ pid: 999999999 });
        expect(result).toBe(false);
      });
    });
  });
});
