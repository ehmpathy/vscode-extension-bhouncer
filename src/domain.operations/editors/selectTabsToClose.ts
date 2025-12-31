import type * as vscode from 'vscode';

import type { BouncePolicy } from '../../domain.objects/BouncePolicy';
import type { EditorTabInfo } from '../../domain.objects/EditorTabInfo';
import { getBouncePolicy } from './getBouncePolicy';

/**
 * .what = selects which tabs should be closed based on limits, idle time, and per-extension policy
 * .why = implements policy-aware pruning: IDLE_LIMIT, TABS_LIMIT, or BOTH per extension
 */
export const selectTabsToClose = (input: {
  tabs: EditorTabInfo[];
  maxOpen: number;
  idleTimeoutMs: number;
  now: number;
  bounceOnByExtension?: Record<string, BouncePolicy>;
}): vscode.Tab[] => {
  const tabsToClose: vscode.Tab[] = [];

  // evaluate each tab against policy-aware pruning criteria
  input.tabs.forEach((item, index) => {
    // resolve policy for this tab's extension
    const policy = getBouncePolicy({
      uri: item.uri,
      config: input.bounceOnByExtension ?? {},
    });

    const isOverLimit = index >= input.maxOpen;

    // tab is idle if: has been accessed AND accessed longer than timeout ago
    // tabs with lastAccess === 0 are untracked (newly opened), not idle
    const isIdle =
      item.lastAccess > 0 &&
      input.now - item.lastAccess > input.idleTimeoutMs;

    // apply policy-aware closure logic
    const shouldClose = (() => {
      if (policy === 'IDLE_LIMIT') return isIdle;
      if (policy === 'TABS_LIMIT') return isOverLimit;
      return isOverLimit || isIdle; // BOTH
    })();

    if (shouldClose) {
      tabsToClose.push(item.tab);
    }
  });

  return tabsToClose;
};
