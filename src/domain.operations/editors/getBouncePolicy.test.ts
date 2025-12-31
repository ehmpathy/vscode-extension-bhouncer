import type { BouncePolicy } from '../../domain.objects/BouncePolicy';
import { getBouncePolicy } from './getBouncePolicy';

const cases: Array<{
  description: string;
  given: { uri: string; config: Record<string, BouncePolicy> };
  expect: { policy: BouncePolicy };
}> = [
  {
    description: 'returns configured policy for .md extension',
    given: {
      uri: 'file:///docs/readme.md',
      config: { '.md': 'TABS_LIMIT' },
    },
    expect: { policy: 'TABS_LIMIT' },
  },
  {
    description: 'returns configured policy for .ts extension',
    given: {
      uri: 'file:///src/index.ts',
      config: { '.ts': 'IDLE_LIMIT' },
    },
    expect: { policy: 'IDLE_LIMIT' },
  },
  {
    description: 'returns BOTH for unconfigured extension',
    given: {
      uri: 'file:///src/index.ts',
      config: { '.md': 'TABS_LIMIT' },
    },
    expect: { policy: 'BOTH' },
  },
  {
    description: 'returns BOTH when config is empty',
    given: {
      uri: 'file:///src/index.ts',
      config: {},
    },
    expect: { policy: 'BOTH' },
  },
  {
    description: 'returns BOTH for uri without extension',
    given: {
      uri: 'file:///path/to/Makefile',
      config: { '.md': 'TABS_LIMIT' },
    },
    expect: { policy: 'BOTH' },
  },
  {
    description: 'handles uppercase extension via lowercase normalization',
    given: {
      uri: 'file:///docs/README.MD',
      config: { '.md': 'TABS_LIMIT' },
    },
    expect: { policy: 'TABS_LIMIT' },
  },
  {
    description: 'handles query params in uri',
    given: {
      uri: 'file:///docs/readme.md?preview=true',
      config: { '.md': 'TABS_LIMIT' },
    },
    expect: { policy: 'TABS_LIMIT' },
  },
];

describe('getBouncePolicy', () => {
  cases.forEach((thisCase) =>
    test(thisCase.description, () => {
      const result = getBouncePolicy(thisCase.given);
      expect(result).toEqual(thisCase.expect.policy);
    }),
  );
});
