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

import { enableLanguageServer } from './enableLanguageServer';
import { disableLanguageServer } from './disableLanguageServer';
const mockEnable = enableLanguageServer as jest.Mock;
const mockDisable = disableLanguageServer as jest.Mock;

describe('checkAndUpdateLanguageServers', () => {
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
    extensions: ['.js', '.ts', '.tsx'],
    settingKey: 'eslint.enable',
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

    when('relevant files are open for a server that is currently disabled', () => {
      then('enables that server', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer];
            // server is currently disabled (detected=dead, desired=live)
            if (key === 'terraform.languageServer.enable') return false;
            return undefined;
          }),
          update: jest.fn(),
        });

        // terraform files are open
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

    when('no relevant files are open for a server that is currently enabled', () => {
      then('disables that server', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer];
            // server is currently enabled (detected=live, desired=dead)
            if (key === 'terraform.languageServer.enable') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        // no terraform files open
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
            // terraform is enabled but no files open (detected=live, desired=dead)
            if (key === 'terraform.languageServer.enable') return true;
            // eslint is disabled but files are open (detected=dead, desired=live)
            if (key === 'eslint.enable') return false;
            return undefined;
          }),
          update: jest.fn(),
        });

        // only typescript files open (eslint needed, terraform not)
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/index.ts' }),
            createMockTab({ fsPath: '/project/App.tsx' }),
          ]),
        ];

        await checkAndUpdateLanguageServers({ state });

        // terraform disabled, eslint enabled
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

    when('no tabs are open and all servers are currently enabled', () => {
      then('disables all servers', async () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'servers') return [terraformServer, eslintServer];
            // both servers currently enabled (detected=live, desired=dead)
            if (key === 'terraform.languageServer.enable') return true;
            if (key === 'eslint.enable') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

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
            // server is disabled and no files open (detected=dead, desired=dead)
            if (key === 'terraform.languageServer.enable') return false;
            return undefined;
          }),
          update: jest.fn(),
        });

        // no terraform files open
        window.tabGroups.all = [];

        await checkAndUpdateLanguageServers({ state });

        // no action taken since already in desired state
        expect(mockDisable).not.toHaveBeenCalled();
        expect(mockEnable).not.toHaveBeenCalled();
      });
    });
  });
});
