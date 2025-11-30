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
  });
});
