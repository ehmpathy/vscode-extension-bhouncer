import { given, when, then } from 'test-fns';

import { resetMocks, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { createOutput } from '../output/createOutput';
import { disableUntrackedServers } from './disableUntrackedServers';

describe('disableUntrackedServers', () => {
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

  given('untracked servers to disable', () => {
    when('single server needs to be disabled', () => {
      then('disables that server setting', async () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        const mockUpdate = jest.fn();
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(true),
          update: mockUpdate,
        });

        await disableUntrackedServers(
          { untrackedServers: [terraformServer] },
          { state },
        );

        // onPrune hook updates 'enable' on scoped config
        expect(mockUpdate).toHaveBeenCalledWith(
          'enable',
          false,
          2, // vscode.ConfigurationTarget.Workspace
        );
      });
    });

    when('multiple servers need to be disabled', () => {
      then('disables all server settings', async () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        const mockUpdate = jest.fn();
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn().mockReturnValue(true),
          update: mockUpdate,
        });

        await disableUntrackedServers(
          { untrackedServers: [terraformServer, eslintServer] },
          { state },
        );

        // both onPrune hooks update 'enable' on their scoped configs
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        expect(mockUpdate).toHaveBeenCalledWith(
          'enable',
          false,
          2, // vscode.ConfigurationTarget.Workspace
        );
      });
    });

    when('no servers need to be disabled', () => {
      then('does not update any settings', async () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        const mockUpdate = jest.fn();
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        await disableUntrackedServers({ untrackedServers: [] }, { state });

        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });
  });
});
