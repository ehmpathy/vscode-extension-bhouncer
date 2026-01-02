import { given, when, then } from 'test-fns';

import type { BouncePolicy } from '../../domain.objects/BouncePolicy';
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
      then('returns those tabs to close', () => {
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
      then('returns all tabs that match either condition', () => {
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
      then('returns that tab to close', () => {
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

  given('bounceOnByExtension policy is configured', () => {
    when('policy is TABS_LIMIT for .md files', () => {
      const bounceOnByExtension: Record<string, BouncePolicy> = {
        '.md': 'TABS_LIMIT',
      };

      then('.md file is NOT closed when idle but under tabs limit', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file:///docs/readme.md', now - 120000), // idle but should NOT close
          createTabInfo('file:///src/index.ts', now - 1000), // recent
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10,
          idleTimeoutMs: 60000,
          now,
          bounceOnByExtension,
        });

        // .md file stays open despite being idle (TABS_LIMIT policy)
        expect(result).toHaveLength(0);
      });

      then('.md file IS closed when over tabs limit', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file:///src/index.ts', now - 1000),
          createTabInfo('file:///src/other.ts', now - 2000),
          createTabInfo('file:///docs/readme.md', now - 3000), // over limit
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 2,
          idleTimeoutMs: 600000, // none idle
          now,
          bounceOnByExtension,
        });

        // .md file closes because over limit
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(tabs[2].tab);
      });
    });

    when('policy is IDLE_LIMIT for .ts files', () => {
      const bounceOnByExtension: Record<string, BouncePolicy> = {
        '.ts': 'IDLE_LIMIT',
      };

      then('.ts file is NOT closed when over limit but not idle', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file:///src/a.ts', now - 1000),
          createTabInfo('file:///src/b.ts', now - 2000),
          createTabInfo('file:///src/c.ts', now - 3000), // over limit but not idle
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 2,
          idleTimeoutMs: 60000, // 60s - none are idle
          now,
          bounceOnByExtension,
        });

        // .ts files stay open despite being over limit (IDLE_LIMIT policy)
        expect(result).toHaveLength(0);
      });

      then('.ts file IS closed when idle', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file:///src/recent.ts', now - 1000),
          createTabInfo('file:///src/idle.ts', now - 120000), // idle
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10,
          idleTimeoutMs: 60000,
          now,
          bounceOnByExtension,
        });

        // idle .ts file closes
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(tabs[1].tab);
      });
    });

    when('policy is BOTH (default) for unconfigured extensions', () => {
      const bounceOnByExtension: Record<string, BouncePolicy> = {
        '.md': 'TABS_LIMIT',
      };

      then('.js file closes on idle (default BOTH policy)', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file:///src/index.js', now - 120000), // idle, unconfigured ext
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10,
          idleTimeoutMs: 60000,
          now,
          bounceOnByExtension,
        });

        // .js uses default BOTH, closes on idle
        expect(result).toHaveLength(1);
      });

      then('.js file closes on over limit (default BOTH policy)', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file:///src/a.js', now - 1000),
          createTabInfo('file:///src/b.js', now - 2000),
          createTabInfo('file:///src/c.js', now - 3000), // over limit
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 2,
          idleTimeoutMs: 600000,
          now,
          bounceOnByExtension,
        });

        // .js uses default BOTH, closes on over limit
        expect(result).toHaveLength(1);
      });
    });

    when('bounceOnByExtension is empty', () => {
      then('all tabs use BOTH policy (backwards compatible)', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file:///docs/readme.md', now - 120000), // idle
          createTabInfo('file:///src/index.ts', now - 1000),
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10,
          idleTimeoutMs: 60000,
          now,
          bounceOnByExtension: {},
        });

        // .md closes on idle with empty config (BOTH default)
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(tabs[0].tab);
      });
    });

    when('bounceOnByExtension is not provided', () => {
      then('all tabs use BOTH policy (backwards compatible)', () => {
        const now = Date.now();
        const tabs = [
          createTabInfo('file:///docs/readme.md', now - 120000), // idle
        ];

        const result = selectTabsToClose({
          tabs,
          maxOpen: 10,
          idleTimeoutMs: 60000,
          now,
          // bounceOnByExtension not provided
        });

        // .md closes on idle without config (BOTH default)
        expect(result).toHaveLength(1);
      });
    });
  });
});
