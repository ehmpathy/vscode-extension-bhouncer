import { given, when, then } from 'test-fns';

import { resetMocks, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { createOutput } from '../output/createOutput';
import { detectUntrackedServers } from './detectUntrackedServers';

// mock getPids to control which processes are "live"
jest.mock('../processes/getPids', () => ({
  getPids: jest.fn(),
}));

import { getPids } from '../processes/getPids';
const mockGetPids = getPids as jest.Mock;

describe('detectUntrackedServers', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  const terraformServer = {
    extensions: ['.tf', '.tfvars'],
    slug: 'terraform',
  };

  const eslintServer = {
    extensions: ['.js', '.ts'],
    slug: 'eslint',
  };

  given('configured language servers', () => {
    when('no servers have live processes', () => {
      then('returns empty untracked list', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer];
            return undefined;
          }),
        }));

        mockGetPids.mockReturnValue(new Set());

        const result = detectUntrackedServers({ state });

        expect(result.untrackedServers).toEqual([]);
      });
    });

    when('server has live process but is already tracked in memory', () => {
      then('returns empty untracked list', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform', 12345);

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer];
            return undefined;
          }),
        }));

        mockGetPids.mockReturnValue(new Set(['12345']));

        const result = detectUntrackedServers({ state });

        expect(result.untrackedServers).toEqual([]);
      });
    });

    when('server has live process that is not tracked in memory', () => {
      then('returns that server as untracked', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer];
            return undefined;
          }),
        }));

        // process is live but not tracked in memory
        mockGetPids.mockReturnValue(new Set(['99999']));

        const result = detectUntrackedServers({ state });

        expect(result.untrackedServers).toEqual([terraformServer]);
      });
    });

    when('server has live process with different pid than tracked', () => {
      then('returns that server as untracked', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform', 12345);

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer];
            return undefined;
          }),
        }));

        // different pid than tracked
        mockGetPids.mockReturnValue(new Set(['99999']));

        const result = detectUntrackedServers({ state });

        expect(result.untrackedServers).toEqual([terraformServer]);
      });
    });

    when('multiple servers with mixed track state', () => {
      then('returns only untracked servers', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform', 12345);

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer, eslintServer];
            return undefined;
          }),
        }));

        mockGetPids.mockImplementation(({ pattern }: { pattern: string }) => {
          if (pattern === 'terraform-ls') return new Set(['12345']);
          if (pattern === 'eslint') return new Set(['88888']);
          return new Set();
        });

        const result = detectUntrackedServers({ state });

        // terraform is tracked in memory, eslint is not
        expect(result.untrackedServers).toEqual([eslintServer]);
      });
    });

    when('multiple servers both untracked', () => {
      then('returns all untracked servers', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer, eslintServer];
            return undefined;
          }),
        }));

        mockGetPids.mockImplementation(({ pattern }: { pattern: string }) => {
          if (pattern === 'terraform-ls') return new Set(['12345']);
          if (pattern === 'eslint') return new Set(['88888']);
          return new Set();
        });

        const result = detectUntrackedServers({ state });

        // neither server is tracked in memory
        expect(result.untrackedServers).toEqual([terraformServer, eslintServer]);
      });
    });
  });
});
