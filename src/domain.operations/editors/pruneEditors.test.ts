import { given, when, then } from 'test-fns';

import {
  createMockTab,
  createMockTabGroup,
  resetMocks,
  window,
  workspace,
} from '../../.test/mocks/vscode';
import { createExtensionState } from '../../domain.objects/ExtensionState';
import { pruneEditors } from './pruneEditors';

// mock the checkAndUpdateLanguageServers to avoid testing it here
jest.mock('../servers/checkAndUpdateLanguageServers', () => ({
  checkAndUpdateLanguageServers: jest.fn(),
}));

describe('pruneEditors', () => {
  beforeEach(() => {
    resetMocks();
    jest.clearAllMocks();
  });

  given('pruning configuration and state', () => {
    when('bhouncer is disabled', () => {
      then('does not prune any tabs', async () => {
        const state = createExtensionState();

        // configure bhouncer as disabled
        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return false;
            return undefined;
          }),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([createMockTab({ fsPath: '/project/file.ts' })]),
        ];

        await pruneEditors({ state });

        expect(window.tabGroups.close).not.toHaveBeenCalled();
      });
    });

    when('bhouncer is enabled with no stale tabs', () => {
      then('does not close any tabs', async () => {
        const now = Date.now();
        const state = createExtensionState();

        // all tabs accessed recently
        state.editorLastAccess.set('file:///project/a.ts', now - 1000);
        state.editorLastAccess.set('file:///project/b.ts', now - 2000);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'editors.maxOpen') return 10;
            if (key === 'editors.idleTimeoutMinutes') return 10;
            if (key === 'editors.excludePatterns') return [];
            if (key === 'editors.excludePinned') return true;
            if (key === 'editors.excludeDirty') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/a.ts' }),
            createMockTab({ fsPath: '/project/b.ts' }),
          ]),
        ];

        await pruneEditors({ state });

        expect(window.tabGroups.close).not.toHaveBeenCalled();
      });
    });

    when('tabs exceed maxOpen AND are idle', () => {
      then('closes stale tabs', async () => {
        const now = Date.now();
        const state = createExtensionState();

        // tabs: 2 recent, 2 idle (over 10 min old)
        state.editorLastAccess.set('file:///project/recent1.ts', now - 1000);
        state.editorLastAccess.set('file:///project/recent2.ts', now - 2000);
        state.editorLastAccess.set(
          'file:///project/idle1.ts',
          now - 15 * 60 * 1000,
        ); // 15 min ago
        state.editorLastAccess.set(
          'file:///project/idle2.ts',
          now - 20 * 60 * 1000,
        ); // 20 min ago

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'editors.maxOpen') return 2; // only keep 2
            if (key === 'editors.idleTimeoutMinutes') return 10; // 10 min idle timeout
            if (key === 'editors.excludePatterns') return [];
            if (key === 'editors.excludePinned') return true;
            if (key === 'editors.excludeDirty') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/recent1.ts' }),
            createMockTab({ fsPath: '/project/recent2.ts' }),
            createMockTab({ fsPath: '/project/idle1.ts' }),
            createMockTab({ fsPath: '/project/idle2.ts' }),
          ]),
        ];

        await pruneEditors({ state });

        // should close the idle tabs
        expect(window.tabGroups.close).toHaveBeenCalledTimes(1);
        const closedTabs = (window.tabGroups.close as jest.Mock).mock.calls[0][0];
        expect(closedTabs).toHaveLength(2);
      });
    });

    when('tabs are over limit but not idle', () => {
      then('closes tabs over limit (OR logic)', async () => {
        const now = Date.now();
        const state = createExtensionState();

        // all tabs accessed recently
        state.editorLastAccess.set('file:///project/a.ts', now - 1000);
        state.editorLastAccess.set('file:///project/b.ts', now - 2000);
        state.editorLastAccess.set('file:///project/c.ts', now - 3000);

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'editors.maxOpen') return 2;
            if (key === 'editors.idleTimeoutMinutes') return 10;
            if (key === 'editors.excludePatterns') return [];
            if (key === 'editors.excludePinned') return true;
            if (key === 'editors.excludeDirty') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/a.ts' }),
            createMockTab({ fsPath: '/project/b.ts' }),
            createMockTab({ fsPath: '/project/c.ts' }),
          ]),
        ];

        await pruneEditors({ state });

        // c.ts is over limit, so it gets closed
        expect(window.tabGroups.close).toHaveBeenCalledTimes(1);
        const closedTabs = (window.tabGroups.close as jest.Mock).mock.calls[0][0];
        expect(closedTabs).toHaveLength(1);
      });
    });

    when('tabs are idle but within maxOpen limit', () => {
      then('closes idle tabs (OR logic)', async () => {
        const now = Date.now();
        const state = createExtensionState();

        // both idle, but only 2 tabs (within limit of 10)
        state.editorLastAccess.set(
          'file:///project/a.ts',
          now - 15 * 60 * 1000,
        );
        state.editorLastAccess.set(
          'file:///project/b.ts',
          now - 20 * 60 * 1000,
        );

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'editors.maxOpen') return 10;
            if (key === 'editors.idleTimeoutMinutes') return 10;
            if (key === 'editors.excludePatterns') return [];
            if (key === 'editors.excludePinned') return true;
            if (key === 'editors.excludeDirty') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/a.ts' }),
            createMockTab({ fsPath: '/project/b.ts' }),
          ]),
        ];

        await pruneEditors({ state });

        // both are idle so both get closed
        expect(window.tabGroups.close).toHaveBeenCalledTimes(1);
        const closedTabs = (window.tabGroups.close as jest.Mock).mock.calls[0][0];
        expect(closedTabs).toHaveLength(2);
      });
    });
  });
});
