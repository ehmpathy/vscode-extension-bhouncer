import { given, when, then } from 'test-fns';

import {
  createMockTab,
  createMockTabGroup,
  resetMocks,
  window,
  workspace,
} from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { checkAndUpdateLanguageServers } from './checkAndUpdateLanguageServers';

// mock bottleneck to remove delays in tests
jest.mock('bottleneck', () => {
  const MockBottleneck = jest.fn().mockImplementation(() => ({
    schedule: (fn: () => Promise<void>) => fn(),
  }));
  // expose strategy constants for the OVERFLOW strategy
  (MockBottleneck as any).strategy = {
    LEAK: 1,
    OVERFLOW: 2,
    OVERFLOW_PRIORITY: 4,
    BLOCK: 3,
  };
  return MockBottleneck;
});

// mock enable and disable to avoid actual server manipulation
jest.mock('./enableLanguageServer', () => ({
  enableLanguageServer: jest.fn(),
}));
jest.mock('./disableLanguageServer', () => ({
  disableLanguageServer: jest.fn(),
}));

// mock getPids to control process detection
jest.mock('../processes/getPids', () => ({
  getPids: jest.fn(),
}));

import { enableLanguageServer } from './enableLanguageServer';
import { disableLanguageServer } from './disableLanguageServer';
import { getPids } from '../processes/getPids';
const mockEnable = enableLanguageServer as jest.Mock;
const mockDisable = disableLanguageServer as jest.Mock;
const mockGetPids = getPids as jest.Mock;

describe('checkAndUpdateLanguageServers', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  const terraformServer = {
    extensions: ['.tf', '.tfvars'],
    slug: 'terraform',
    processPattern: 'terraform-ls',
  };

  const eslintServer = {
    extensions: ['.js', '.ts', '.tsx'],
    slug: 'eslint',
    processPattern: 'eslintServer',
  };

  given('configured language servers', () => {
    when('bhouncer is disabled', () => {
      then('does not check or update servers', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return false;
            return undefined;
          }),
          update: jest.fn(),
        });

        await checkAndUpdateLanguageServers({ state });

        expect(mockEnable).not.toHaveBeenCalled();
        expect(mockDisable).not.toHaveBeenCalled();
      });
    });

    when('relevant files are open for a server that is not running', () => {
      then('enables that server', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // server is not running (detected=dead)
        mockGetPids.mockReturnValue(new Set());

        // terraform files are open (desired=live)
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/main.tf' }),
            createMockTab({ fsPath: '/project/vars.tfvars' }),
          ]),
        ];

        await checkAndUpdateLanguageServers({ state });

        expect(mockEnable).toHaveBeenCalledWith(
          { config: terraformServer },
          { state },
        );
        expect(mockDisable).not.toHaveBeenCalled();
      });
    });

    when('no relevant files are open for a server that is running', () => {
      then('disables that server', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // server is running (detected=live)
        mockGetPids.mockReturnValue(new Set(['12345']));

        // no terraform files open (desired=dead)
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/index.ts' }),
            createMockTab({ fsPath: '/project/readme.md' }),
          ]),
        ];

        await checkAndUpdateLanguageServers({ state });

        expect(mockDisable).toHaveBeenCalledWith(
          { config: terraformServer },
          { state },
        );
        expect(mockEnable).not.toHaveBeenCalled();
      });
    });

    when('multiple servers configured with mixed open files and opposite states', () => {
      then('enables servers with open files and disables others', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer, eslintServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // terraform is running, eslint is not
        mockGetPids.mockImplementation(({ pattern }: { pattern: string }) => {
          if (pattern === 'terraform-ls') return new Set(['12345']); // running
          if (pattern === 'eslintServer') return new Set(); // not running
          return new Set();
        });

        // only typescript files open (eslint needed, terraform not)
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/index.ts' }),
            createMockTab({ fsPath: '/project/App.tsx' }),
          ]),
        ];

        await checkAndUpdateLanguageServers({ state });

        // terraform disabled (running but no files), eslint enabled (not running but files open)
        expect(mockDisable).toHaveBeenCalledWith(
          { config: terraformServer },
          { state },
        );
        expect(mockEnable).toHaveBeenCalledWith(
          { config: eslintServer },
          { state },
        );
      });
    });

    when('no tabs are open and all servers are currently running', () => {
      then('disables all servers', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer, eslintServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // both servers running
        mockGetPids.mockReturnValue(new Set(['12345']));

        window.tabGroups.all = [];

        await checkAndUpdateLanguageServers({ state });

        expect(mockDisable).toHaveBeenCalledTimes(2);
        expect(mockEnable).not.toHaveBeenCalled();
      });
    });

    when('server is already in desired state', () => {
      then('skips enable/disable action', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // server is not running (detected=dead)
        mockGetPids.mockReturnValue(new Set());

        // no terraform files open (desired=dead)
        window.tabGroups.all = [];

        await checkAndUpdateLanguageServers({ state });

        // no action taken since already in desired state (dead=dead)
        expect(mockDisable).not.toHaveBeenCalled();
        expect(mockEnable).not.toHaveBeenCalled();
      });
    });
  });
});
