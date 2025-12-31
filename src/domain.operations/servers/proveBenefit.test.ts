import { given, when, then } from 'test-fns';

import { resetMocks, window, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import type { LanguageServerConfig } from '../../domain.objects/LanguageServerConfig';
import { disableLanguageServer } from './disableLanguageServer';
import { showStatus } from './showStatus';

// mock killPidSafely to avoid actually killing processes
jest.mock('../processes/killPidSafely', () => ({
  killPidSafely: jest.fn(),
}));

// mock saveTrackedPids to avoid filesystem writes
jest.mock('../state/saveTrackedPids', () => ({
  saveTrackedPids: jest.fn(),
}));

// mock getProcessResources to provide controlled resource data
jest.mock('../processes/getProcessResources', () => ({
  getProcessResources: jest.fn(),
}));

import { killPidSafely } from '../processes/killPidSafely';
import { getProcessResources } from '../processes/getProcessResources';

const mockKillPidSafely = killPidSafely as jest.Mock;
const mockGetProcessResources = getProcessResources as jest.Mock;

/**
 * unit tests for "prove-benefit" behavior
 *
 * .what = verifies that bhouncer proves its benefit via ✨ output logs
 * .why = users need to see clear evidence of resources freed
 *
 * .note = true acceptance tests would run in a real vscode environment;
 *         these are unit tests that verify the integrated behavior with mocks
 */
describe('proveBenefit', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  const terraformConfig: LanguageServerConfig = {
    slug: 'terraform',
    extensions: ['.tf', '.tfvars'],
    processPattern: 'terraform-ls',
  };

  const eslintConfig: LanguageServerConfig = {
    slug: 'eslint',
    extensions: ['.js', '.ts', '.tsx'],
    processPattern: 'eslint',
  };

  given('[case1] language server with tracked resources', () => {
    when('[t0] server is killed after last editor closes', () => {
      then('emits ✨ server.killed log with memory freed', async () => {
        const mockInfo = jest.fn();
        const mockDebug = jest.fn();
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);
        state.output = { info: mockInfo, debug: mockDebug } as never;

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: jest.fn().mockResolvedValue(undefined),
        });

        // simulate resource capture before kill
        mockGetProcessResources.mockReturnValue({
          pid: 12345,
          memoryBytes: 157286400, // 150 MB
          cpuPercent: 3.5,
          capturedAt: '2025-01-01T00:00:00.000Z',
        });

        mockKillPidSafely.mockReturnValue({ killed: true });

        // kill the server
        await disableLanguageServer({ config: terraformConfig }, { state });

        // verify ✨ server.killed was logged
        expect(mockInfo).toHaveBeenCalledWith(
          '✨ server.killed',
          expect.objectContaining({
            slug: 'terraform',
            pid: 12345,
            memoryFreed: '150.00 MB',
            cpuFreed: '3.5%',
          }),
        );
      });

      then('emits ✨ resources.freed log with before/after comparison', async () => {
        const mockInfo = jest.fn();
        const mockDebug = jest.fn();
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);
        state.output = { info: mockInfo, debug: mockDebug } as never;

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: jest.fn().mockResolvedValue(undefined),
        });

        mockGetProcessResources.mockReturnValue({
          pid: 12345,
          memoryBytes: 157286400, // 150 MB
          cpuPercent: 3.5,
          capturedAt: '2025-01-01T00:00:00.000Z',
        });

        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // verify ✨ resources.freed was logged
        expect(mockInfo).toHaveBeenCalledWith(
          '✨ resources.freed',
          expect.objectContaining({
            memoryBefore: '150.00 MB',
            memoryAfter: '0 B',
            memoryDelta: '+150.00 MB',
            cpuBefore: '3.5%',
            cpuAfter: '0%',
          }),
        );
      });
    });
  });

  given('[case2] multiple servers killed in a session', () => {
    when('[t0] showStatus command is executed', () => {
      then('displays ✨ session benefits with aggregate totals', async () => {
        const mockInfo = jest.fn();
        const mockDebug = jest.fn();
        const state = createExtensionState();
        state.output = { info: mockInfo, debug: mockDebug } as never;

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            return undefined;
          }),
          update: jest.fn().mockResolvedValue(undefined),
        });

        // simulate first server kill
        state.trackedPids.set('terraform', 12345);
        mockGetProcessResources.mockReturnValue({
          pid: 12345,
          memoryBytes: 157286400, // 150 MB
          cpuPercent: 3.5,
          capturedAt: '2025-01-01T00:00:00.000Z',
        });
        mockKillPidSafely.mockReturnValue({ killed: true });
        await disableLanguageServer({ config: terraformConfig }, { state });

        // simulate second server kill
        state.trackedPids.set('eslint', 67890);
        mockGetProcessResources.mockReturnValue({
          pid: 67890,
          memoryBytes: 52428800, // 50 MB
          cpuPercent: 1.2,
          capturedAt: '2025-01-01T00:01:00.000Z',
        });
        await disableLanguageServer({ config: eslintConfig }, { state });

        // now check showStatus displays aggregate benefits
        showStatus({ state });

        // verify modal shows ✨ session benefits
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('✨ session benefits:'),
          expect.anything(),
        );

        // verify shows server count
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('servers killed: 2'),
          expect.anything(),
        );

        // verify shows total memory freed (150 MB + 50 MB = 200 MB)
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('memory freed: 200.00 MB'),
          expect.anything(),
        );
      });
    });
  });

  given('[case3] server killed but resources not captured', () => {
    when('[t0] getProcessResources returns null', () => {
      then('does not emit ✨ output logs', async () => {
        const mockInfo = jest.fn();
        const mockDebug = jest.fn();
        const state = createExtensionState();
        state.trackedPids.set('terraform', 12345);
        state.output = { info: mockInfo, debug: mockDebug } as never;

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn(),
          update: jest.fn().mockResolvedValue(undefined),
        });

        // resource capture fails (process exited before we could capture)
        mockGetProcessResources.mockReturnValue(null);
        mockKillPidSafely.mockReturnValue({ killed: true });

        await disableLanguageServer({ config: terraformConfig }, { state });

        // should not emit ✨ logs
        expect(mockInfo).not.toHaveBeenCalledWith(
          '✨ server.killed',
          expect.anything(),
        );
        expect(mockInfo).not.toHaveBeenCalledWith(
          '✨ resources.freed',
          expect.anything(),
        );
      });
    });
  });

  given('[case4] no servers killed in session', () => {
    when('[t0] showStatus command is executed', () => {
      then('does not display ✨ session benefits section', () => {
        const state = createExtensionState();
        // no killRecords

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        showStatus({ state });

        // should not show ✨ session benefits section
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.not.stringContaining('✨ session benefits:'),
          expect.anything(),
        );
      });
    });
  });
});
