import { given, when, then } from 'test-fns';

import { resetMocks, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { enableLanguageServer } from './enableLanguageServer';

// mock getPids to control the before/after pid detection
jest.mock('../processes/getPids', () => ({
  getPids: jest.fn(),
}));

// mock saveTrackedPids to avoid filesystem writes
jest.mock('../state/saveTrackedPids', () => ({
  saveTrackedPids: jest.fn(),
}));

// get the mocked function
import { getPids } from '../processes/getPids';
const mockGetPids = getPids as jest.Mock;

describe('enableLanguageServer', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  const terraformConfig: LanguageServerConfig = {
    extensions: ['.tf', '.tfvars'],
    settingKey: 'terraform.languageServer.enable',
    processPattern: 'terraform-ls',
  };

  given('a language server configuration', () => {
    when('server is already enabled', () => {
      then('does not re-enable it', async () => {
        const state = createExtensionState();
        const mockUpdate = jest.fn();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(true), // already enabled
          update: mockUpdate,
        });

        await enableLanguageServer({ config: terraformConfig }, { state });

        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    when('server is disabled', () => {
      then('enables it and tracks the new pid', async () => {
        const state = createExtensionState();
        const mockUpdate = jest.fn().mockResolvedValue(undefined);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(false), // disabled
          update: mockUpdate,
        });

        // before enabling: no pids
        // after enabling: one new pid spawned
        mockGetPids
          .mockReturnValueOnce(new Set<string>()) // before
          .mockReturnValueOnce(new Set(['12345'])); // after

        await enableLanguageServer({ config: terraformConfig }, { state });

        // should have called update with true
        expect(mockUpdate).toHaveBeenCalledWith(
          'terraform.languageServer.enable',
          true,
          expect.anything(),
        );

        // should have tracked the new pid
        expect(state.trackedPids.get('terraform.languageServer.enable')).toBe(
          12345,
        );
      });
    });

    when('server enables but no new pid is detected', () => {
      then('does not track any pid', async () => {
        const state = createExtensionState();
        const mockUpdate = jest.fn().mockResolvedValue(undefined);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(false),
          update: mockUpdate,
        });

        // before and after: same pids (no new pid spawned)
        mockGetPids
          .mockReturnValueOnce(new Set(['99999']))
          .mockReturnValueOnce(new Set(['99999']));

        await enableLanguageServer({ config: terraformConfig }, { state });

        expect(mockUpdate).toHaveBeenCalled();
        expect(state.trackedPids.size).toBe(0);
      });
    });

    when('existing pid already running and new pid spawns', () => {
      then('only tracks the new pid (the one not in before)', async () => {
        const state = createExtensionState();
        const mockUpdate = jest.fn().mockResolvedValue(undefined);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(false),
          update: mockUpdate,
        });

        // before: pid 11111 exists (from another workspace)
        // after: pid 11111 + new pid 22222
        mockGetPids
          .mockReturnValueOnce(new Set(['11111']))
          .mockReturnValueOnce(new Set(['11111', '22222']));

        await enableLanguageServer({ config: terraformConfig }, { state });

        // should track only the new pid
        expect(state.trackedPids.get('terraform.languageServer.enable')).toBe(
          22222,
        );
      });
    });
  });
});
