/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
  moduleNameMapper: {
    // mock vscode module for unit tests
    '^vscode$': '<rootDir>/src/.test/mocks/vscode.ts',
  },
};
