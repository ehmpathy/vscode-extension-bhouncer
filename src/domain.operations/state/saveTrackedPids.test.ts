import * as fs from 'fs';
import { given, when, then } from 'test-fns';

import { resetMocks, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { createOutput } from '../output/createOutput';
import { saveTrackedPids } from './saveTrackedPids';

// mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('saveTrackedPids', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
    // default mock for readFileSync (used by findsertVscodeGitignore)
    mockFs.readFileSync.mockReturnValue('');
  });

  given('a workspace folder', () => {
    beforeEach(() => {
      workspace.workspaceFolders = [
        { uri: { fsPath: '/mock/workspace' }, name: 'workspace', index: 0 },
      ];
    });

    when('tracked pids exist in state', () => {
      then('writes them to state file', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform.languageServer.enable', 12345);
        state.trackedPids.set('eslint.enable', 67890);

        mockFs.existsSync.mockReturnValue(true);

        saveTrackedPids({ state });

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          '/mock/workspace/.vscode/bhouncer.state.json',
          JSON.stringify(
            {
              trackedPids: {
                'terraform.languageServer.enable': 12345,
                'eslint.enable': 67890,
              },
            },
            null,
            2,
          ),
          'utf8',
        );
      });
    });

    when('.vscode directory does not exist', () => {
      then('creates it before writing', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform.languageServer.enable', 12345);

        mockFs.existsSync.mockReturnValue(false);

        saveTrackedPids({ state });

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          '/mock/workspace/.vscode',
          { recursive: true },
        );
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });
    });

    when('no tracked pids in state', () => {
      then('writes empty object', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });

        mockFs.existsSync.mockReturnValue(true);

        saveTrackedPids({ state });

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          '/mock/workspace/.vscode/bhouncer.state.json',
          JSON.stringify({ trackedPids: {} }, null, 2),
          'utf8',
        );
      });
    });

    when('write fails', () => {
      then('logs warning and does not crash', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform.languageServer.enable', 12345);

        mockFs.existsSync.mockReturnValue(true);
        mockFs.writeFileSync.mockImplementation((path: string) => {
          // only throw for the state file, not the gitignore
          if (path.endsWith('bhouncer.state.json')) {
            throw new Error('permission denied');
          }
        });

        // should not throw
        expect(() => saveTrackedPids({ state })).not.toThrow();
      });
    });
  });

  given('no workspace folder', () => {
    when('saveTrackedPids is called', () => {
      then('skips saving', () => {
        const state = createExtensionState();
        state.output = createOutput({ enabled: false });
        state.trackedPids.set('terraform.languageServer.enable', 12345);

        workspace.workspaceFolders = undefined;

        saveTrackedPids({ state });

        expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      });
    });
  });
});
