import { given, when, then } from 'test-fns';

import { resetMocks, window, workspace } from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { showStatus } from './showStatus';

describe('showStatus', () => {
  beforeEach(() => {
    resetMocks();
  });

  given('extension state', () => {
    when('bhouncer is enabled with tracked editors and servers', () => {
      then('shows status with counts and tracked pids', () => {
        const state = createExtensionState();
        state.editorLastAccess.set('file:///project/a.ts', Date.now());
        state.editorLastAccess.set('file:///project/b.ts', Date.now());
        state.trackedPids.set('terraform.languageServer.enable', 12345);
        state.trackedPids.set('eslint.enable', 67890);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        showStatus({ state });

        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('bhouncer: enabled'),
          expect.anything(),
        );
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('tracked editors: 2'),
          expect.anything(),
        );
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('active language servers: 2'),
          expect.anything(),
        );
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('terraform.languageServer.enable: 12345'),
          expect.anything(),
        );
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('eslint.enable: 67890'),
          expect.anything(),
        );
      });
    });

    when('bhouncer is disabled', () => {
      then('shows disabled status', () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return false;
            return undefined;
          }),
          update: jest.fn(),
        });

        showStatus({ state });

        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('bhouncer: disabled'),
          expect.anything(),
        );
      });
    });

    when('no editors or servers are tracked', () => {
      then('shows zero counts', () => {
        const state = createExtensionState();

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        showStatus({ state });

        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('tracked editors: 0'),
          expect.anything(),
        );
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('active language servers: 0'),
          expect.anything(),
        );
      });
    });

    when('servers have been killed this session', () => {
      then('shows ✨ session benefits section', () => {
        const state = createExtensionState();

        // add kill records
        state.killRecords.push({
          settingKey: 'terraform.languageServer.enable',
          pid: 12345,
          killedAt: '2025-01-01T00:00:00.000Z',
          resourcesBefore: {
            pid: 12345,
            memoryBytes: 52428800, // 50 MB
            cpuPercent: 2.5,
            capturedAt: '2025-01-01T00:00:00.000Z',
          },
          memoryFreedBytes: 52428800,
          cpuFreedPercent: 2.5,
        });
        state.killRecords.push({
          settingKey: 'eslint.enable',
          pid: 67890,
          killedAt: '2025-01-01T00:01:00.000Z',
          resourcesBefore: {
            pid: 67890,
            memoryBytes: 31457280, // 30 MB
            cpuPercent: 1.0,
            capturedAt: '2025-01-01T00:01:00.000Z',
          },
          memoryFreedBytes: 31457280,
          cpuFreedPercent: 1.0,
        });
        state.totalMemoryFreedBytes = 83886080; // 80 MB

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        showStatus({ state });

        // should show ✨ session benefits header
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('✨ session benefits:'),
          expect.anything(),
        );

        // should show servers killed count
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('servers killed: 2'),
          expect.anything(),
        );

        // should show memory freed formatted
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.stringContaining('memory freed: 80.00 MB'),
          expect.anything(),
        );
      });
    });

    when('no servers have been killed this session', () => {
      then('does not show ✨ session benefits section', () => {
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

        // should not show ✨ session benefits header
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          expect.not.stringContaining('✨ session benefits:'),
          expect.anything(),
        );
      });
    });
  });
});
