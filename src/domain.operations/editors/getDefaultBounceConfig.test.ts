import { getDefaultBounceConfig } from './getDefaultBounceConfig';

describe('getDefaultBounceConfig', () => {
  test('returns TABS_LIMIT for .md extension', () => {
    const config = getDefaultBounceConfig();
    expect(config['.md']).toEqual('TABS_LIMIT');
  });

  test('returns TABS_LIMIT for .markdown extension', () => {
    const config = getDefaultBounceConfig();
    expect(config['.markdown']).toEqual('TABS_LIMIT');
  });

  test('returns exactly two entries', () => {
    const config = getDefaultBounceConfig();
    expect(Object.keys(config)).toHaveLength(2);
  });

  test('does not include .ts extension', () => {
    const config = getDefaultBounceConfig();
    expect(config['.ts']).toBeUndefined();
  });
});
