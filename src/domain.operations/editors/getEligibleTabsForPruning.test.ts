import { given, when, then } from 'test-fns';

import {
  createMockTab,
  createMockTabGroup,
  resetMocks,
  window,
} from '../../.test/mocks/vscode';
import { getEligibleTabsForPruning } from './getEligibleTabsForPruning';

describe('getEligibleTabsForPruning', () => {
  beforeEach(() => {
    resetMocks();
  });

  given('tabs and exclusion settings', () => {
    when('no tabs are open', () => {
      then('returns empty tabs and zero stats', () => {
        window.tabGroups.all = [];

        const result = getEligibleTabsForPruning({
          editorLastAccess: new Map(),
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: true,
        });

        expect(result.tabs).toEqual([]);
        expect(result.stats).toEqual({
          total: 0,
          nonText: 0,
          pinned: 0,
          dirty: 0,
          excluded: 0,
        });
      });
    });

    when('tabs exist with access times', () => {
      then('sorts tabs by last access (most recent first)', () => {
        const now = Date.now();
        const editorLastAccess = new Map([
          ['file:///project/old.ts', now - 3000],
          ['file:///project/newer.ts', now - 1000],
          ['file:///project/middle.ts', now - 2000],
        ]);

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/old.ts' }),
            createMockTab({ fsPath: '/project/newer.ts' }),
            createMockTab({ fsPath: '/project/middle.ts' }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess,
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: true,
        });

        expect(result.tabs).toHaveLength(3);
        expect(result.tabs[0].uri).toContain('newer.ts');
        expect(result.tabs[1].uri).toContain('middle.ts');
        expect(result.tabs[2].uri).toContain('old.ts');
        expect(result.stats.total).toBe(3);
      });
    });

    when('excludePinned is true', () => {
      then('excludes pinned tabs', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/pinned.ts', isPinned: true }),
            createMockTab({ fsPath: '/project/normal.ts', isPinned: false }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess: new Map(),
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: true,
        });

        expect(result.tabs).toHaveLength(1);
        expect(result.tabs[0].uri).toContain('normal.ts');
        expect(result.stats.pinned).toBe(1);
      });
    });

    when('excludePinned is false', () => {
      then('includes pinned tabs', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/pinned.ts', isPinned: true }),
            createMockTab({ fsPath: '/project/normal.ts', isPinned: false }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess: new Map(),
          excludePatterns: [],
          excludePinned: false,
          excludeDirty: true,
        });

        expect(result.tabs).toHaveLength(2);
        expect(result.stats.pinned).toBe(0);
      });
    });

    when('excludeDirty is true', () => {
      then('excludes dirty tabs', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/dirty.ts', isDirty: true }),
            createMockTab({ fsPath: '/project/clean.ts', isDirty: false }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess: new Map(),
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: true,
        });

        expect(result.tabs).toHaveLength(1);
        expect(result.tabs[0].uri).toContain('clean.ts');
        expect(result.stats.dirty).toBe(1);
      });
    });

    when('excludeDirty is false', () => {
      then('includes dirty tabs', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/dirty.ts', isDirty: true }),
            createMockTab({ fsPath: '/project/clean.ts', isDirty: false }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess: new Map(),
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: false,
        });

        expect(result.tabs).toHaveLength(2);
        expect(result.stats.dirty).toBe(0);
      });
    });

    when('exclude patterns match some tabs', () => {
      then('excludes tabs that match', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/package.json' }),
            createMockTab({ fsPath: '/project/src/index.ts' }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess: new Map(),
          excludePatterns: ['**/package.json'],
          excludePinned: true,
          excludeDirty: true,
        });

        expect(result.tabs).toHaveLength(1);
        expect(result.tabs[0].uri).toContain('index.ts');
        expect(result.stats.excluded).toBe(1);
      });
    });

    when('tabs have no recorded access time', () => {
      then('uses 0 as default last access', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/never-accessed.ts' }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess: new Map(), // empty map
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: true,
        });

        expect(result.tabs).toHaveLength(1);
        expect(result.tabs[0].lastAccess).toBe(0);
      });
    });

    when('tabs across multiple groups', () => {
      then('collects tabs from all groups', () => {
        window.tabGroups.all = [
          createMockTabGroup([createMockTab({ fsPath: '/project/a.ts' })]),
          createMockTabGroup([createMockTab({ fsPath: '/project/b.ts' })]),
          createMockTabGroup([createMockTab({ fsPath: '/project/c.ts' })]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess: new Map(),
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: true,
        });

        expect(result.tabs).toHaveLength(3);
        expect(result.stats.total).toBe(3);
      });
    });

    when('tabs have lastAccess=0 (untracked/newly opened)', () => {
      then('sorts them first, treating as most recent', () => {
        const now = Date.now();
        const editorLastAccess = new Map([
          ['file:///project/old.ts', now - 3000],
          ['file:///project/newer.ts', now - 1000],
          // newly-opened.ts has no entry => lastAccess = 0
        ]);

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/old.ts' }),
            createMockTab({ fsPath: '/project/newer.ts' }),
            createMockTab({ fsPath: '/project/newly-opened.ts' }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess,
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: true,
        });

        // newly opened (lastAccess=0) should be first, then by recency
        expect(result.tabs).toHaveLength(3);
        expect(result.tabs[0].uri).toContain('newly-opened.ts');
        expect(result.tabs[0].lastAccess).toBe(0);
        expect(result.tabs[1].uri).toContain('newer.ts');
        expect(result.tabs[2].uri).toContain('old.ts');
      });
    });

    when('multiple tabs have lastAccess=0', () => {
      then('all are sorted before tracked tabs', () => {
        const now = Date.now();
        const editorLastAccess = new Map([
          ['file:///project/tracked.ts', now - 1000],
        ]);

        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/tracked.ts' }),
            createMockTab({ fsPath: '/project/new1.ts' }),
            createMockTab({ fsPath: '/project/new2.ts' }),
          ]),
        ];

        const result = getEligibleTabsForPruning({
          editorLastAccess,
          excludePatterns: [],
          excludePinned: true,
          excludeDirty: true,
        });

        // both untracked tabs should come before the tracked one
        expect(result.tabs).toHaveLength(3);
        expect(result.tabs[0].lastAccess).toBe(0);
        expect(result.tabs[1].lastAccess).toBe(0);
        expect(result.tabs[2].uri).toContain('tracked.ts');
        expect(result.tabs[2].lastAccess).toBe(now - 1000);
      });
    });
  });
});
