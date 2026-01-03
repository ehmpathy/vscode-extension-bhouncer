import { given, when, then } from 'test-fns';

import { resetMocks, workspace, commands } from '../../.test/mocks/vscode';
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
    slug: 'terraform',
    extensions: ['.tf', '.tfvars'],
  };

  given('a language server configuration', () => {
    when('server is already live and tracked', () => {
      then('does not re-enable it', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);
        const mockUpdate = jest.fn();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // tracked pid is still live
        mockGetPids.mockReturnValue(new Set(['12345']));

        await enableLanguageServer({ config: terraformConfig }, { state });

        // should not call onStart since already live and tracked
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });

    when('server is not live', () => {
      then('enables it and tracks the new pid', async () => {
        const state = createExtensionState();
        const mockUpdate = jest.fn().mockResolvedValue(undefined);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // before enable: no pids
        // after enable: one new pid spawned
        mockGetPids
          .mockReturnValueOnce(new Set<string>()) // before
          .mockReturnValueOnce(new Set(['12345'])); // after

        await enableLanguageServer({ config: terraformConfig }, { state });

        // onStart hook updates 'enable' on scoped config
        expect(mockUpdate).toHaveBeenCalledWith(
          'enable',
          true,
          expect.anything(),
        );

        // should have tracked the new pid by slug
        expect(state.trackedPids.get('terraform')).toBe(12345);
      });
    });

    when('server restarts but reuses prior pid', () => {
      then('tracks the prior pid for management', async () => {
        const state = createExtensionState();
        const mockUpdate = jest.fn().mockResolvedValue(undefined);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // before and after: same pids (restart reused the same process)
        mockGetPids
          .mockReturnValueOnce(new Set(['99999']))
          .mockReturnValueOnce(new Set(['99999']));

        await enableLanguageServer({ config: terraformConfig }, { state });

        // onStart hook is called
        expect(mockUpdate).toHaveBeenCalled();
        // prior pid is tracked (restart may reuse same process)
        expect(state.trackedPids.get('terraform')).toBe(99999);
      });
    });

    when('prior pid already live and new pid spawns', () => {
      then('only tracks the new pid (the one not in before)', async () => {
        const state = createExtensionState();
        const mockUpdate = jest.fn().mockResolvedValue(undefined);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // before: pid 11111 exists (from another workspace)
        // after: pid 11111 + new pid 22222
        mockGetPids
          .mockReturnValueOnce(new Set(['11111']))
          .mockReturnValueOnce(new Set(['11111', '22222']));

        await enableLanguageServer({ config: terraformConfig }, { state });

        // should track only the new pid by slug
        expect(state.trackedPids.get('terraform')).toBe(22222);
      });
    });

    when('tracked pid is no longer live', () => {
      then('restarts the server and tracks new pid', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345); // tracked but dead
        const mockUpdate = jest.fn().mockResolvedValue(undefined);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // tracked pid 12345 is not live, new pid 67890 spawns after
        mockGetPids
          .mockReturnValueOnce(new Set<string>()) // before (12345 not live)
          .mockReturnValueOnce(new Set(['67890'])); // after

        await enableLanguageServer({ config: terraformConfig }, { state });

        // onStart hook is called
        expect(mockUpdate).toHaveBeenCalledWith(
          'enable',
          true,
          expect.anything(),
        );

        // should track the new pid
        expect(state.trackedPids.get('terraform')).toBe(67890);
      });
    });
  });

  given('typescript server configuration (command-based)', () => {
    const typescriptConfig: LanguageServerConfig = {
      slug: 'typescript',
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    };

    when('server is not live', () => {
      then('calls typescript.restartTsServer command and tracks pid', async () => {
        const state = createExtensionState();
        const mockUpdate = jest.fn().mockResolvedValue(undefined);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // before: no tsserver live
        // after: tsserver spawned
        mockGetPids
          .mockReturnValueOnce(new Set<string>())
          .mockReturnValueOnce(new Set(['54321']));

        await enableLanguageServer({ config: typescriptConfig }, { state });

        // onStart hook calls restartTsServer command (not setting toggle)
        expect(commands.executeCommand).toHaveBeenCalledWith(
          'typescript.restartTsServer',
        );

        // should NOT call workspace config update (typescript uses command, not setting)
        expect(mockUpdate).not.toHaveBeenCalled();

        // should track the new pid
        expect(state.trackedPids.get('typescript')).toBe(54321);
      });
    });

    when('server is already live and tracked', () => {
      then('does not restart the server', async () => {
        const state = createExtensionState();
        state.trackedPids.set('typescript', 54321);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: jest.fn(),
        });

        // tracked pid is live
        mockGetPids.mockReturnValue(new Set(['54321']));

        await enableLanguageServer({ config: typescriptConfig }, { state });

        // should not call restartTsServer
        expect(commands.executeCommand).not.toHaveBeenCalled();
      });
    });
  });
});
