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

// mock enable, disable, and restart to avoid actual server manipulation
jest.mock('./enableLanguageServer', () => ({
  enableLanguageServer: jest.fn(),
}));
jest.mock('./disableLanguageServer', () => ({
  disableLanguageServer: jest.fn(),
}));
jest.mock('./restartLanguageServer', () => ({
  restartLanguageServer: jest.fn(),
}));

// mock getPids to control process detection
jest.mock('../processes/getPids', () => ({
  getPids: jest.fn(),
}));

import { enableLanguageServer } from './enableLanguageServer';
import { disableLanguageServer } from './disableLanguageServer';
import { restartLanguageServer } from './restartLanguageServer';
import { getPids } from '../processes/getPids';
const mockEnable = enableLanguageServer as jest.Mock;
const mockDisable = disableLanguageServer as jest.Mock;
const mockRestart = restartLanguageServer as jest.Mock;
const mockGetPids = getPids as jest.Mock;

describe('checkAndUpdateLanguageServers', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  const terraformServer = {
    extensions: ['.tf', '.tfvars'],
    slug: 'terraform',
  };

  const eslintServer = {
    extensions: ['.js', '.ts', '.tsx'],
    slug: 'eslint',
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

    when('relevant files are open for a server that is not live', () => {
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

        // server is not live (detected=dead)
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

    when('no relevant files are open for a server that is live and tracked', () => {
      then('disables that server', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345); // tracked pid

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // server is live (detected=live)
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
      then('enables servers with open files and disables tracked others', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345); // tracked

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer, eslintServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // terraform is live, eslint is not
        mockGetPids.mockImplementation(({ pattern }: { pattern: string }) => {
          if (pattern === 'terraform-ls') return new Set(['12345']); // live
          if (pattern === 'eslint') return new Set(); // not live
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

        // terraform disabled (tracked + live but no files), eslint enabled (not live but files open)
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

    when('no tabs are open and all tracked servers are currently live', () => {
      then('disables all tracked servers', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);
        state.trackedPids.set('eslint', 67890);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer, eslintServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // both servers live
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

        // server is not live (detected=dead)
        mockGetPids.mockReturnValue(new Set());

        // no terraform files open (desired=dead)
        window.tabGroups.all = [];

        await checkAndUpdateLanguageServers({ state });

        // no action taken since already in desired state (dead=dead)
        expect(mockDisable).not.toHaveBeenCalled();
        expect(mockEnable).not.toHaveBeenCalled();
      });
    });

    when('server is live but pid is not tracked and files are open', () => {
      then('restarts server to capture the pid', async () => {
        const state = createExtensionState();
        // no tracked pid for this server

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // server is live (detected=live) but we don't have its pid
        mockGetPids.mockReturnValue(new Set(['99999']));

        // terraform files are open (desired=live)
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/main.tf' }),
          ]),
        ];

        await checkAndUpdateLanguageServers({ state });

        // should restart to capture the pid
        expect(mockRestart).toHaveBeenCalledWith(
          { config: terraformServer },
          { state },
        );
      });
    });

    when('server is live with tracked pid and files are open', () => {
      then('skips action since already managed', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform', 99999); // we track it

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer];
            return undefined;
          }),
          update: jest.fn(),
        });

        // server is live and we track its pid
        mockGetPids.mockReturnValue(new Set(['99999']));

        // terraform files are open (desired=live)
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/main.tf' }),
          ]),
        ];

        await checkAndUpdateLanguageServers({ state });

        // no action needed - already live and tracked
        expect(mockEnable).not.toHaveBeenCalled();
        expect(mockDisable).not.toHaveBeenCalled();
      });
    });
  });
});
