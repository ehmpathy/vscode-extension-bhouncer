import type * as vscode from 'vscode';

import type { EditorTabInfo } from '../../domain.objects/EditorTabInfo';

/**
 * .what = selects which tabs should be closed based on limits and idle time
 * .why = implements the pruning policy: close tabs that are over limit OR idle
 */
export const selectTabsToClose = (input: {
  tabs: EditorTabInfo[];
  maxOpen: number;
  idleTimeoutMs: number;
  now: number;
}): vscode.Tab[] => {
  const tabsToClose: vscode.Tab[] = [];

  // evaluate each tab against pruning criteria
  input.tabs.forEach((item, index) => {
    const isOverLimit = index >= input.maxOpen;

    // tab is idle if: has been accessed AND accessed longer than timeout ago
    // tabs with lastAccess === 0 are untracked (newly opened), not idle
    const isIdle =
      item.lastAccess > 0 &&
      input.now - item.lastAccess > input.idleTimeoutMs;

    // close if over limit OR idle
    if (isOverLimit || isIdle) {
      tabsToClose.push(item.tab);
    }
  });

  return tabsToClose;
};
