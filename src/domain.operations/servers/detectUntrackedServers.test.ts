import { given, when, then } from 'test-fns';

import { resetMocks, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { createOutput } from '../output/createOutput';
import { detectUntrackedServers } from './detectUntrackedServers';

// mock getPids to control which processes are "running"
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
    settingKey: 'terraform.languageServer.enable',
    processPattern: 'terraform-ls',
  };

  const eslintServer = {
    extensions: ['.js', '.ts'],
    settingKey: 'eslint.enable',
    processPattern: 'eslintServer',
  };

  given('configured language servers', () => {
    when('no servers have running processes', () => {
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

    when('server has running process but is already tracked in memory', () => {
      then('returns empty untracked list', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform.languageServer.enable', 12345);

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

    when('server has running process but is already disabled in settings', () => {
      then('returns empty untracked list', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer];
            // server is disabled in workspace settings
            if (key === 'terraform.languageServer.enable') return false;
            return undefined;
          }),
        }));

        // process is running but setting is already disabled
        mockGetPids.mockReturnValue(new Set(['99999']));

        const result = detectUntrackedServers({ state });

        expect(result.untrackedServers).toEqual([]);
      });
    });

    when('server has running process that is not tracked and not disabled', () => {
      then('returns that server as untracked', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer];
            // server is enabled (or not set) in workspace settings
            if (key === 'terraform.languageServer.enable') return true;
            return undefined;
          }),
        }));

        mockGetPids.mockReturnValue(new Set(['99999']));

        const result = detectUntrackedServers({ state });

        expect(result.untrackedServers).toEqual([terraformServer]);
      });
    });

    when('server has running process with different pid than tracked', () => {
      then('returns that server as untracked', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform.languageServer.enable', 12345);

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer];
            // server is enabled in workspace settings
            if (key === 'terraform.languageServer.enable') return true;
            return undefined;
          }),
        }));

        // different pid than tracked
        mockGetPids.mockReturnValue(new Set(['99999']));

        const result = detectUntrackedServers({ state });

        expect(result.untrackedServers).toEqual([terraformServer]);
      });
    });

    when('multiple servers with mixed tracking state', () => {
      then('returns only untracked servers', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform.languageServer.enable', 12345);

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer, eslintServer];
            // both servers enabled in workspace settings
            if (key === 'terraform.languageServer.enable') return true;
            if (key === 'eslint.enable') return true;
            return undefined;
          }),
        }));

        mockGetPids.mockImplementation(({ pattern }: { pattern: string }) => {
          if (pattern === 'terraform-ls') return new Set(['12345']);
          if (pattern === 'eslintServer') return new Set(['88888']);
          return new Set();
        });

        const result = detectUntrackedServers({ state });

        // terraform is tracked in memory, eslint is not
        expect(result.untrackedServers).toEqual([eslintServer]);
      });
    });

    when('multiple servers where one is disabled in settings', () => {
      then('returns only untracked servers not disabled in settings', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockImplementation((section?: string) => ({
          get: jest.fn((key: string) => {
            if (section === 'bhouncer' && key === 'servers')
              return [terraformServer, eslintServer];
            // terraform is disabled in settings (tracked), eslint is enabled
            if (key === 'terraform.languageServer.enable') return false;
            if (key === 'eslint.enable') return true;
            return undefined;
          }),
        }));

        mockGetPids.mockImplementation(({ pattern }: { pattern: string }) => {
          if (pattern === 'terraform-ls') return new Set(['12345']);
          if (pattern === 'eslintServer') return new Set(['88888']);
          return new Set();
        });

        const result = detectUntrackedServers({ state });

        // terraform is tracked via settings (disabled), eslint is untracked
        expect(result.untrackedServers).toEqual([eslintServer]);
      });
    });
  });
});
