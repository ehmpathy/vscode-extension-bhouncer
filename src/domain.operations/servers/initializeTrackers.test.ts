import { given, when, then } from 'test-fns';

import { commands, resetMocks, window, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { createOutput } from '../output/createOutput';
import { initializeTrackers } from './initializeTrackers';

// mock detection and disable operations
jest.mock('./detectUntrackedServers', () => ({
  detectUntrackedServers: jest.fn(),
}));
jest.mock('./disableUntrackedServers', () => ({
  disableUntrackedServers: jest.fn(),
}));

import { detectUntrackedServers } from './detectUntrackedServers';
import { disableUntrackedServers } from './disableUntrackedServers';
const mockDetect = detectUntrackedServers as jest.Mock;
const mockDisable = disableUntrackedServers as jest.Mock;

describe('initializeTrackers', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  const terraformServer = {
    extensions: ['.tf', '.tfvars'],
    slug: 'terraform',
    processPattern: 'terraform-ls',
  };

  given('extension activation', () => {
    when('no untracked servers detected', () => {
      then('does not prompt for reload', async () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockDetect.mockReturnValue({ untrackedServers: [] });

        await initializeTrackers({ state });

        expect(mockDisable).not.toHaveBeenCalled();
        expect(window.showWarningMessage).not.toHaveBeenCalled();
      });
    });

    when('untracked servers detected', () => {
      then('disables them and prompts for reload', async () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockDetect.mockReturnValue({ untrackedServers: [terraformServer] });
        window.showWarningMessage.mockResolvedValue(undefined);

        await initializeTrackers({ state });

        expect(mockDisable).toHaveBeenCalledWith(
          { untrackedServers: [terraformServer] },
          { state },
        );
        expect(window.showWarningMessage).toHaveBeenCalledWith(
          expect.stringContaining('1 running language server'),
          'Reload Window',
        );
      });
    });

    when('user clicks reload', () => {
      then('disables all servers and executes reload command', async () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockDetect.mockReturnValue({ untrackedServers: [terraformServer] });
        window.showWarningMessage.mockResolvedValue('Reload Window');

        // mock bhouncer.servers configuration to return all configured servers
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue([terraformServer]),
          update: jest.fn().mockResolvedValue(undefined),
        });

        await initializeTrackers({ state });

        // should disable ALL configured servers before reload (not just untracked)
        expect(mockDisable).toHaveBeenCalledTimes(2);
        expect(mockDisable).toHaveBeenLastCalledWith(
          { untrackedServers: [terraformServer] },
          { state },
        );

        expect(commands.executeCommand).toHaveBeenCalledWith(
          'workbench.action.reloadWindow',
        );
      });
    });

    when('user dismisses reload prompt', () => {
      then('does not reload', async () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockDetect.mockReturnValue({ untrackedServers: [terraformServer] });
        window.showWarningMessage.mockResolvedValue(undefined);

        await initializeTrackers({ state });

        expect(commands.executeCommand).not.toHaveBeenCalled();
      });
    });
  });
});
