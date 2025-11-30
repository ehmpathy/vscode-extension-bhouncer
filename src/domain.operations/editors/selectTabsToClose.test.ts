import { given, when, then } from 'test-fns';

import type { EditorTabInfo } from '../../domain.objects/EditorTabInfo';
import { selectTabsToClose } from './selectTabsToClose';

describe('selectTabsToClose', () => {
  // helper to create mock tab info
  const createTabInfo = (uri: string, lastAccess: number): EditorTabInfo => ({
    tab: { uri } as unknown as EditorTabInfo['tab'],
    uri,
    lastAccess,
  });

  given('a list of tabs sorted by last access', () => {
    when('all tabs are within limits and not idle', () => {
      then('returns empty array', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file1.ts', now - 1000),
          createTabInfo('file2.ts', now - 2000),
          createTabInfo('file3.ts', now - 3000),
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10,
          idleTimeoutMs: 60000,
          now,
        });

        expect(result).toEqual([]);
      });
    });

    when('tabs exceed maxOpen but are not idle', () => {
      then('returns tabs over limit (OR logic)', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file1.ts', now - 1000),
          createTabInfo('file2.ts', now - 2000),
          createTabInfo('file3.ts', now - 3000),
          createTabInfo('file4.ts', now - 4000),
          createTabInfo('file5.ts', now - 5000),
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 3,
          idleTimeoutMs: 60000, // 60 seconds - none are idle
          now,
        });

        // tabs over limit are closed (file4, file5)
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(tabs[3].tab);
        expect(result[1]).toBe(tabs[4].tab);
      });
    });

    when('tabs are idle but within maxOpen limit', () => {
      then('returns idle tabs (OR logic)', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file1.ts', now - 120000), // 2 min ago - idle
          createTabInfo('file2.ts', now - 180000), // 3 min ago - idle
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10,
          idleTimeoutMs: 60000, // 60 seconds
          now,
        });

        // both are idle so both are closed
        expect(result).toHaveLength(2);
      });
    });

    when('tabs exceed maxOpen AND are idle', () => {
      then('returns those tabs for closing', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('recent1.ts', now - 1000), // recent
          createTabInfo('recent2.ts', now - 2000), // recent
          createTabInfo('idle1.ts', now - 120000), // over limit + idle
          createTabInfo('idle2.ts', now - 180000), // over limit + idle
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 2,
          idleTimeoutMs: 60000,
          now,
        });

        expect(result).toHaveLength(2);
        expect(result[0]).toBe(tabs[2].tab);
        expect(result[1]).toBe(tabs[3].tab);
      });
    });

    when('tab has lastAccess of 0 (untracked/newly opened)', () => {
      then('is NOT considered idle and kept open', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file1.ts', now - 1000),
          createTabInfo('file2.ts', now - 2000),
          createTabInfo('never-accessed.ts', 0), // lastAccess = 0 = untracked = not idle
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10, // under limit
          idleTimeoutMs: 60000,
          now,
        });

        // untracked tabs are NOT considered idle - they're newly opened
        expect(result).toHaveLength(0);
      });
    });

    when('tab has lastAccess of 0 but is over limit', () => {
      then('is closed due to limit', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file1.ts', now - 1000),
          createTabInfo('file2.ts', now - 2000),
          createTabInfo('file3.ts', now - 3000),
          createTabInfo('never-accessed.ts', 0), // over limit
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 3,
          idleTimeoutMs: 60000,
          now,
        });

        // untracked tab is closed because it's over limit (not because idle)
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(tabs[3].tab);
      });
    });

    when('mixed: some over limit, some idle, some both', () => {
      then('returns all tabs matching either condition', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('recent.ts', now - 1000), // under limit, not idle
          createTabInfo('recent2.ts', now - 2000), // under limit, not idle
          createTabInfo('recent-over.ts', now - 5000), // over limit, not idle
          createTabInfo('idle-over.ts', now - 120000), // over limit + idle
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 2,
          idleTimeoutMs: 60000,
          now,
        });

        // recent-over is over limit, idle-over is both over limit AND idle
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(tabs[2].tab);
        expect(result[1]).toBe(tabs[3].tab);
      });
    });

    when('tab is under limit but idle', () => {
      then('returns that tab for closing', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('recent.ts', now - 1000), // not idle
          createTabInfo('idle.ts', now - 120000), // idle (2 min > 1 min timeout)
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10, // plenty of room
          idleTimeoutMs: 60000, // 1 min
          now,
        });

        // idle tab is closed even though under limit
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(tabs[1].tab);
      });
    });
  });
});
