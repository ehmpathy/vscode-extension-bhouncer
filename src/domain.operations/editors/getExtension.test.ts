import { getExtension } from './getExtension';

const cases = [
  {
    description: 'extracts .ts extension from simple uri',
    given: { uri: 'file:///path/to/file.ts' },
    expect: { extension: '.ts' },
  },
  {
    description: 'extracts .md extension with query params stripped',
    given: { uri: 'file:///path/to/file.md?query=1' },
    expect: { extension: '.md' },
  },
  {
    description: 'returns empty string for uri without extension',
    given: { uri: 'file:///path/to/Makefile' },
    expect: { extension: '' },
  },
  {
    description: 'extracts last extension for multiple dots',
    given: { uri: 'file:///path/to/file.test.ts' },
    expect: { extension: '.ts' },
  },
  {
    description: 'returns lowercase extension for uppercase input',
    given: { uri: 'file:///path/to/README.MD' },
    expect: { extension: '.md' },
  },
  {
    description: 'handles dotfiles without extension',
    given: { uri: 'file:///path/to/.gitignore' },
    expect: { extension: '.gitignore' },
  },
  {
    description: 'handles dotfiles with extension',
    given: { uri: 'file:///path/to/.eslintrc.json' },
    expect: { extension: '.json' },
  },
];

describe('getExtension', () => {
  cases.forEach((thisCase) =>
    test(thisCase.description, () => {
      const result = getExtension(thisCase.given);
      expect(result).toEqual(thisCase.expect.extension);
    }),
  );
});
