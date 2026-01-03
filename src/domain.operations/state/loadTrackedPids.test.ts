import * as fs from 'fs';
import { given, when, then } from 'test-fns';

import { resetMocks, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { createOutput } from '../output/createOutput';
import { loadTrackedPids } from './loadTrackedPids';

// mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// mock isPidActive to control which pids are considered active
jest.mock('../processes/isPidActive', () => ({
  isPidActive: jest.fn(),
}));
import { isPidActive } from '../processes/isPidActive';
const mockIsPidActive = isPidActive as jest.Mock;

describe('loadTrackedPids', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  given('a workspace folder', () => {
    beforeEach(() => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/mock/workspace' }, name: 'workspace', index: 0 },
      ];
    });

    when('state file does not exist', () => {
      then('does not load any pids', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockFs.existsSync.mockReturnValue(false);

        loadTrackedPids({ state });

        expect(state.trackedPids.size).toEqual(0);
      });
    });

    when('state file exists with valid data and all pids active', () => {
      then('loads tracked pids into state', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            trackedPids: {
              'terraform': 12345,
              'eslint': 67890,
            },
          }),
        );
        mockIsPidActive.mockReturnValue(true);

        loadTrackedPids({ state });

        expect(state.trackedPids.size).toEqual(2);
        expect(state.trackedPids.get('terraform')).toEqual(
          12345,
        );
        expect(state.trackedPids.get('eslint')).toEqual(67890);
      });
    });

    when('state file exists but some pids are stale', () => {
      then('only loads active pids', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(
          JSON.stringify({
            trackedPids: {
              'terraform': 12345,
              'eslint': 67890,
            },
          }),
        );

        // terraform pid is active, eslint pid is stale
        mockIsPidActive
          .mockReturnValueOnce(true) // terraform
          .mockReturnValueOnce(false); // eslint

        loadTrackedPids({ state });

        expect(state.trackedPids.size).toEqual(1);
        expect(state.trackedPids.get('terraform')).toEqual(
          12345,
        );
        expect(state.trackedPids.has('eslint')).toBe(false);
      });
    });

    when('state file exists but is empty', () => {
      then('does not load any pids', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify({}));

        loadTrackedPids({ state });

        expect(state.trackedPids.size).toEqual(0);
      });
    });

    when('state file is invalid json', () => {
      then('logs warning and does not crash', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue('invalid json');

        // should not throw
        expect(() => loadTrackedPids({ state })).not.toThrow();
        expect(state.trackedPids.size).toEqual(0);
      });
    });
  });

  given('no workspace folder', () => {
    when('loadTrackedPids is called', () => {
      then('skips load', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        workspace.workspaceFolders = undefined;

        loadTrackedPids({ state });

        expect(state.trackedPids.size).toEqual(0);
        expect(mockFs.existsSync).not.toHaveBeenCalled();
      });
    });
  });
});
