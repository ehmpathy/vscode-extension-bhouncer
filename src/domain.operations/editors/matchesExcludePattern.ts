import { minimatch } from 'minimatch';

/**
 * .what = checks if a uri matches any glob exclude pattern
 * .why = enables users to protect specific files from auto-close via config
 */
export const matchesExcludePattern = (input: {
  uri: string;
  patterns: string[];
}): boolean => {
  return input.patterns.some((pattern) => minimatch(input.uri, pattern));
};
