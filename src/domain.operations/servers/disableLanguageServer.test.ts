import { given, when, then } from 'test-fns';

import { resetMocks, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { disableLanguageServer } from './disableLanguageServer';

// mock killPidSafely to avoid actually killing processes
jest.mock('../processes/killPidSafely', () => ({
  killPidSafely: jest.fn(),
}));

// mock saveTrackedPids to avoid filesystem writes
jest.mock('../state/saveTrackedPids', () => ({
  saveTrackedPids: jest.fn(),
}));

import { killPidSafely } from '../processes/killPidSafely';
const mockKillPidSafely = killPidSafely as jest.Mock;

describe('disableLanguageServer', () => {
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
    when('server has a tracked pid', () => {
      then('disables setting and kills the pid', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform.languageServer.enable', 12345);

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // should update setting to false
        expect(mockUpdate).toHaveBeenCalledWith(
          'terraform.languageServer.enable',
          false,
          expect.anything(),
        );

        // should kill the pid
        expect(mockKillPidSafely).toHaveBeenCalledWith({ pid: 12345 });

        // should remove from tracked pids
        expect(state.trackedPids.has('terraform.languageServer.enable')).toBe(
          false,
        );
      });
    });

    when('server has tracked pid but process already exited', () => {
      then('removes from tracked pids gracefully', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform.languageServer.enable', 12345);

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        mockKillPidSafely.mockReturnValue({ killed: false }); // already exited

        await disableLanguageServer({ config: terraformConfig }, { state });

        // should still update setting
        expect(mockUpdate).toHaveBeenCalled();

        // should still attempt to kill
        expect(mockKillPidSafely).toHaveBeenCalledWith({ pid: 12345 });

        // should still remove from tracked pids
        expect(state.trackedPids.has('terraform.languageServer.enable')).toBe(
          false,
        );
      });
    });

    when('server has no tracked pid', () => {
      then('only disables the setting', async () => {
        const state = createExtensionState();
        // no tracked pid for this server

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // should update setting
        expect(mockUpdate).toHaveBeenCalledWith(
          'terraform.languageServer.enable',
          false,
          expect.anything(),
        );

        // should not attempt to kill
        expect(mockKillPidSafely).not.toHaveBeenCalled();
      });
    });
  });
});
