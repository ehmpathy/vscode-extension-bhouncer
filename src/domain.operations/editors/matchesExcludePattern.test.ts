import { given, when, then } from 'test-fns';

import { matchesExcludePattern } from './matchesExcludePattern';

describe('matchesExcludePattern', () => {
  given('a uri and patterns', () => {
    when('uri matches a glob pattern', () => {
      then('returns true', () => {
        const result = matchesExcludePattern({
          uri: 'file:///project/package.json',
          patterns: ['**/package.json'],
        });
        expect(result).toBe(true);
      });
    });

    when('uri matches one of multiple patterns', () => {
      then('returns true', () => {
        const result = matchesExcludePattern({
          uri: 'file:///project/src/index.ts',
          patterns: ['**/package.json', '**/*.ts'],
        });
        expect(result).toBe(true);
      });
    });

    when('uri does not match any pattern', () => {
      then('returns false', () => {
        const result = matchesExcludePattern({
          uri: 'file:///project/src/index.ts',
          patterns: ['**/package.json', '**/*.md'],
        });
        expect(result).toBe(false);
      });
    });

    when('patterns array is empty', () => {
      then('returns false', () => {
        const result = matchesExcludePattern({
          uri: 'file:///project/anything.ts',
          patterns: [],
        });
        expect(result).toBe(false);
      });
    });

    when('pattern uses double star for deep matching', () => {
      then('matches nested paths', () => {
        const result = matchesExcludePattern({
          uri: 'file:///project/src/deep/nested/file.config.json',
          patterns: ['**/*.config.json'],
        });
        expect(result).toBe(true);
      });
    });
  });
});
