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

// mock getProcessResources for benefit tracking tests
jest.mock('../processes/getProcessResources', () => ({
  getProcessResources: jest.fn(),
}));

import { killPidSafely } from '../processes/killPidSafely';
import { getProcessResources } from '../processes/getProcessResources';

const mockKillPidSafely = killPidSafely as jest.Mock;
const mockGetProcessResources = getProcessResources as jest.Mock;

describe('disableLanguageServer', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  const terraformConfig: LanguageServerConfig = {
    slug: 'terraform',
    extensions: ['.tf', '.tfvars'],
    processPattern: 'terraform-ls',
  };

  given('a language server configuration', () => {
    when('server has a tracked pid', () => {
      then('disables setting and kills the pid', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // should call onPrune hook which updates 'enable' on scoped config
        expect(mockUpdate).toHaveBeenCalledWith(
          'enable',
          false,
          expect.anything(),
        );

        // should kill the pid
        expect(mockKillPidSafely).toHaveBeenCalledWith({ pid: 12345 });

        // should remove from tracked pids
        expect(state.trackedPids.has('terraform')).toBe(false);
      });
    });

    when('server has tracked pid but process already exited', () => {
      then('removes from tracked pids gracefully', async () => {
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);

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
        expect(state.trackedPids.has('terraform')).toBe(false);
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

        // should call onPrune hook which updates 'enable' on scoped config
        expect(mockUpdate).toHaveBeenCalledWith(
          'enable',
          false,
          expect.anything(),
        );

        // should not attempt to kill
        expect(mockKillPidSafely).not.toHaveBeenCalled();
      });
    });
  });

  given('a language server with tracked pid and resources', () => {
    when('server is killed successfully with resources captured', () => {
      then('records killRecord and emits ✨ benefit output', async () => {
        const mockInfo = jest.fn();
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);
        state.output = { info: mockInfo, debug: jest.fn() } as never;

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // mock resource capture
        mockGetProcessResources.mockReturnValue({
          pid: 12345,
          memoryBytes: 52428800, // 50 MB
          cpuPercent: 2.5,
          capturedAt: '2025-01-01T00:00:00.000Z',
        });

        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // should add killRecord to state
        expect(state.killRecords).toHaveLength(1);
        expect(state.killRecords[0]).toMatchObject({
          slug: 'terraform',
          pid: 12345,
          memoryFreedBytes: 52428800,
          cpuFreedPercent: 2.5,
        });

        // should increment totalMemoryFreedBytes
        expect(state.totalMemoryFreedBytes).toEqual(52428800);

        // should emit ✨ server.killed output
        expect(mockInfo).toHaveBeenCalledWith(
          '✨ server.killed',
          expect.objectContaining({
            slug: 'terraform',
            pid: 12345,
          }),
        );

        // should emit ✨ resources.freed output
        expect(mockInfo).toHaveBeenCalledWith(
          '✨ resources.freed',
          expect.objectContaining({
            memoryBefore: '50.00 MB',
            memoryAfter: '0 B',
          }),
        );
      });

      then('accumulates totalMemoryFreedBytes across multiple kills', async () => {
        const mockInfo = jest.fn();
        const state = createExtensionState();
        state.output = { info: mockInfo, debug: jest.fn() } as never;

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // first kill
        state.trackedPids.set('terraform', 12345);
        mockGetProcessResources.mockReturnValue({
          pid: 12345,
          memoryBytes: 52428800, // 50 MB
          cpuPercent: 2.5,
          capturedAt: '2025-01-01T00:00:00.000Z',
        });
        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // second kill with different config
        const eslintConfig: LanguageServerConfig = {
          slug: 'eslint',
          extensions: ['.js', '.ts'],
          processPattern: 'eslint',
        };
        state.trackedPids.set('eslint', 67890);
        mockGetProcessResources.mockReturnValue({
          pid: 67890,
          memoryBytes: 31457280, // 30 MB
          cpuPercent: 1.2,
          capturedAt: '2025-01-01T00:00:01.000Z',
        });

        await disableLanguageServer({ config: eslintConfig }, { state });

        // should have 2 killRecords
        expect(state.killRecords).toHaveLength(2);

        // should accumulate total memory freed (50 MB + 30 MB = 80 MB)
        expect(state.totalMemoryFreedBytes).toEqual(83886080);
      });
    });

    when('server is killed but getProcessResources returns null', () => {
      then('does not record killRecord or emit ✨ output', async () => {
        const mockInfo = jest.fn();
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);
        state.output = { info: mockInfo, debug: jest.fn() } as never;

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // getProcessResources returns null (process not found before kill)
        mockGetProcessResources.mockReturnValue(null);
        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // should not add killRecord
        expect(state.killRecords).toHaveLength(0);

        // should not increment totalMemoryFreedBytes
        expect(state.totalMemoryFreedBytes).toEqual(0);

        // should not emit ✨ output
        expect(mockInfo).not.toHaveBeenCalledWith(
          '✨ server.killed',
          expect.anything(),
        );
      });
    });

    when('process already exited before kill attempt', () => {
      then('does not record killRecord despite having resources', async () => {
        const mockInfo = jest.fn();
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);
        state.output = { info: mockInfo, debug: jest.fn() } as never;

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // resources captured before kill
        mockGetProcessResources.mockReturnValue({
          pid: 12345,
          memoryBytes: 52428800,
          cpuPercent: 2.5,
          capturedAt: '2025-01-01T00:00:00.000Z',
        });

        // but kill returns false (already exited)
        mockKillPidSafely.mockReturnValue({ killed: false });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // should not add killRecord since we didn't actually kill it
        expect(state.killRecords).toHaveLength(0);

        // should not emit ✨ output
        expect(mockInfo).not.toHaveBeenCalledWith(
          '✨ server.killed',
          expect.anything(),
        );
      });
    });
  });

  given('typescript server configuration (command-based)', () => {
    const typescriptConfig: LanguageServerConfig = {
      slug: 'typescript',
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      processPattern: 'tsserver',
    };

    when('server has a tracked pid', () => {
      then('kills the pid directly without toggling settings', async () => {
        const state = createExtensionState();
        state.trackedPids.set('typescript', 54321);

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: typescriptConfig }, { state });

        // typescript onPrune is a no-op (doesn't toggle settings)
        expect(mockUpdate).not.toHaveBeenCalled();

        // should kill the pid directly
        expect(mockKillPidSafely).toHaveBeenCalledWith({ pid: 54321 });

        // should remove from tracked pids
        expect(state.trackedPids.has('typescript')).toBe(false);
      });
    });

    when('server has tracked pid with resources captured', () => {
      then('records killRecord and emits ✨ benefit output', async () => {
        const mockInfo = jest.fn();
        const state = createExtensionState();
        state.trackedPids.set('typescript', 54321);
        state.output = { info: mockInfo, debug: jest.fn() } as never;

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        // mock resource capture
        mockGetProcessResources.mockReturnValue({
          pid: 54321,
          memoryBytes: 104857600, // 100 MB (tsserver can be heavy)
          cpuPercent: 5.0,
          capturedAt: '2025-01-01T00:00:00.000Z',
        });

        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: typescriptConfig }, { state });

        // should add killRecord to state
        expect(state.killRecords).toHaveLength(1);
        expect(state.killRecords[0]).toMatchObject({
          slug: 'typescript',
          pid: 54321,
          memoryFreedBytes: 104857600,
          cpuFreedPercent: 5.0,
        });

        // should increment totalMemoryFreedBytes
        expect(state.totalMemoryFreedBytes).toEqual(104857600);

        // should emit ✨ server.killed output
        expect(mockInfo).toHaveBeenCalledWith(
          '✨ server.killed',
          expect.objectContaining({
            slug: 'typescript',
            pid: 54321,
          }),
        );
      });
    });

    when('server has no tracked pid', () => {
      then('does nothing (no setting to toggle, no pid to kill)', async () => {
        const state = createExtensionState();
        // no tracked pid for typescript

        const mockUpdate = jest.fn().mockResolvedValue(undefined);
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: mockUpdate,
        });

        await disableLanguageServer({ config: typescriptConfig }, { state });

        // typescript onPrune is a no-op
        expect(mockUpdate).not.toHaveBeenCalled();

        // should not attempt to kill (no pid tracked)
        expect(mockKillPidSafely).not.toHaveBeenCalled();
      });
    });
  });
});
