import { given, when, then } from 'test-fns';

import {
  createMockTab,
  createMockTabGroup,
  resetMocks,
  window,
} from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { createOutput } from '../output/createOutput';
import { detectLanguageServerState } from './detectLanguageServerState';

// mock getPids to control process detection
jest.mock('../processes/getPids', () => ({
  getPids: jest.fn(),
}));

import { getPids } from '../processes/getPids';
const mockGetPids = getPids as jest.Mock;

describe('detectLanguageServerState', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  const terraformServer = {
    extensions: ['.tf', '.tfvars'],
    slug: 'terraform',
  };

  given('a language server config', () => {
    when('relevant files are open and server process is live', () => {
      then('returns desired=live, detected=live', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        // process is live
        mockGetPids.mockReturnValue(new Set(['12345']));

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

    when('relevant files are open but server process is not live', () => {
      then('returns desired=live, detected=dead', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        // process is not live
        mockGetPids.mockReturnValue(new Set());

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

    when('no relevant files are open and server process is live', () => {
      then('returns desired=dead, detected=live', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        // process is live
        mockGetPids.mockReturnValue(new Set(['12345']));

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

    when('no relevant files are open and server process is not live', () => {
      then('returns desired=dead, detected=dead', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        // process is not live
        mockGetPids.mockReturnValue(new Set());

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
