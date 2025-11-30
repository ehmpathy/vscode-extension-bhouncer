import { given, when, then } from 'test-fns';

import { getPids } from './getPids';

describe('getPids', () => {
  given('a process pattern', () => {
    when('matching processes exist', () => {
      then('returns set of pid strings', () => {
        // 'node' should always be running (jest itself uses node)
        const result = getPids({ pattern: 'node' });

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBeGreaterThan(0);

        // all entries should be numeric strings
        for (const pid of result) {
          expect(pid).toMatch(/^\d+$/);
        }
      });
    });

    when('no matching processes exist', () => {
      then('returns empty set', () => {
        // pattern that should never match anything - use exact binary name format
        const result = getPids({ pattern: '^/zzz-no-such-bin-xyz$' });

        expect(result).toBeInstanceOf(Set);
        expect(result.size).toBe(0);
      });
    });

    when('pattern contains special characters', () => {
      then('handles them via shell quoting', () => {
        // this should not throw, just return empty set
        const result = getPids({ pattern: 'test-pattern-with-dashes' });

        expect(result).toBeInstanceOf(Set);
      });
    });
  });
});
