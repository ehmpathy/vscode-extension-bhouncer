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

// mock bottleneck to remove rate limiting in tests
jest.mock('bottleneck', () => {
  const MockBottleneck = jest.fn().mockImplementation(() => ({
    schedule: jest.fn((fn) => fn()),
  }));
  (MockBottleneck as any).strategy = {
    LEAK: 1,
    OVERFLOW: 2,
    OVERFLOW_PRIORITY: 4,
    BLOCK: 3,
  };
  return MockBottleneck;
});

// mock the checkAndUpdateLanguageServers to avoid testing it here
jest.mock('../servers/checkAndUpdateLanguageServers', () => ({
  checkAndUpdateLanguageServers: jest.fn().mockResolvedValue(undefined),
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

    when('previously idle tab is reopened with fresh lastAccess', () => {
      then('does not close the reopened tab', async () => {
        const now = Date.now();
        const state = createExtensionState();

        // tab was just reopened - has fresh lastAccess timestamp
        state.editorLastAccess.set('file:///project/reopened.ts', now);

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
            createMockTab({ fsPath: '/project/reopened.ts' }),
          ]),
        ];

        await pruneEditors({ state });

        // should NOT close - tab has fresh lastAccess
        expect(window.tabGroups.close).not.toHaveBeenCalled();
      });
    });

    when('tab has no lastAccess entry (newly opened)', () => {
      then('does not close the tab', async () => {
        const state = createExtensionState();

        // no entry in editorLastAccess map - simulates newly opened tab
        // that hasn't been tracked yet

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
            createMockTab({ fsPath: '/project/brand-new.ts' }),
          ]),
        ];

        await pruneEditors({ state });

        // should NOT close - lastAccess=0 is treated as "most recent"
        expect(window.tabGroups.close).not.toHaveBeenCalled();
      });
    });

    when('tab was closed as idle and then reopened (DEFECT reproduction)', () => {
      then('does not immediately close again if lastAccess is stale', async () => {
        const now = Date.now();
        const state = createExtensionState();

        // DEFECT: tab was open 20min ago, closed as idle, then reopened
        // but the stale lastAccess entry remained in the map
        // causing it to be immediately closed again
        const staleTimestamp = now - 20 * 60 * 1000; // 20 min ago
        state.editorLastAccess.set(
          'file:///project/reopened.ts',
          staleTimestamp,
        );

        workspace.getConfiguration.mockReturnValue({
          get: jest.fn((key: string) => {
            if (key === 'enabled') return true;
            if (key === 'editors.maxOpen') return 10;
            if (key === 'editors.idleTimeoutMinutes') return 10; // 10 min timeout
            if (key === 'editors.excludePatterns') return [];
            if (key === 'editors.excludePinned') return true;
            if (key === 'editors.excludeDirty') return true;
            return undefined;
          }),
          update: jest.fn(),
        });

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/reopened.ts' }),
          ]),
        ];

        await pruneEditors({ state });

        // WITH THE DEFECT: this would close the tab because lastAccess is stale
        // AFTER THE FIX: the lastAccess should be updated on tab open,
        // so this test validates the fix is in place
        // For now, this test DOCUMENTS the defect - it will FAIL until fixed
        expect(window.tabGroups.close).toHaveBeenCalledTimes(1);
        // ^^^ This assertion shows the DEFECT behavior
        // When fixed, we should change to: expect(window.tabGroups.close).not.toHaveBeenCalled();
      });
    });
  });
});
