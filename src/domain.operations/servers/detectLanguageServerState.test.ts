import { given, when, then } from 'test-fns';

import {
  createMockTab,
  createMockTabGroup,
  resetMocks,
  window,
  workspace,
} from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { createOutput } from '../output/createOutput';
import { detectLanguageServerState } from './detectLanguageServerState';

describe('detectLanguageServerState', () => {
  beforeEach(() => {
    resetMocks();
  });

  const terraformServer = {
    extensions: ['.tf', '.tfvars'],
    settingKey: 'terraform.languageServer.enable',
    processPattern: 'terraform-ls',
  };

  given('a language server config', () => {
    when('relevant files are open and server is enabled', () => {
      then('returns desired=live, detected=live', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(true),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/main.tf' }),
          ]),
        ];

        const result = detectLanguageServerState(
          { config: terraformServer },
          { state },
        );

        expect(result).toEqual({ desired: 'live', detected: 'live' });
      });
    });

    when('relevant files are open but server is disabled', () => {
      then('returns desired=live, detected=dead', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(false),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/main.tf' }),
          ]),
        ];

        const result = detectLanguageServerState(
          { config: terraformServer },
          { state },
        );

        expect(result).toEqual({ desired: 'live', detected: 'dead' });
      });
    });

    when('no relevant files are open and server is enabled', () => {
      then('returns desired=dead, detected=live', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(true),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/index.ts' }),
          ]),
        ];

        const result = detectLanguageServerState(
          { config: terraformServer },
          { state },
        );

        expect(result).toEqual({ desired: 'dead', detected: 'live' });
      });
    });

    when('no relevant files are open and server is disabled', () => {
      then('returns desired=dead, detected=dead', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(false),
          update: jest.fn(),
        });

        window.tabGroups.all = [];

        const result = detectLanguageServerState(
          { config: terraformServer },
          { state },
        );

        expect(result).toEqual({ desired: 'dead', detected: 'dead' });
      });
    });
  });
});
