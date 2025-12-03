import * as vscode from 'vscode';

import type { EditorTabInfo } from '../../domain.objects/EditorTabInfo';
import { matchesExcludePattern } from './matchesExcludePattern';

/**
 * .what = collects tabs eligible for pruning, sorted by last access time
 * .why = centralizes tab filtering logic for editor pruning decisions
 */
export const getEligibleTabsForPruning = (input: {
  editorLastAccess: Map<string, number>;
  excludePatterns: string[];
  excludePinned: boolean;
  excludeDirty: boolean;
}): { tabs: EditorTabInfo[]; stats: { total: number; nonText: number; pinned: number; dirty: number; excluded: number } } => {
  const tabs: EditorTabInfo[] = [];
  const stats = { total: 0, nonText: 0, pinned: 0, dirty: 0, excluded: 0 };

  // iterate through all tab groups and tabs
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      stats.total++;

      // skip non-text tabs
      if (!(tab.input instanceof vscode.TabInputText)) {
        stats.nonText++;
        continue;
      }

      const uri = tab.input.uri.toString();
      const lastAccess = input.editorLastAccess.get(uri) ?? 0;

      // apply exclusion filters
      if (input.excludePinned && tab.isPinned) {
        stats.pinned++;
        continue;
      }
      if (input.excludeDirty && tab.isDirty) {
        stats.dirty++;
        continue;
      }
      if (matchesExcludePattern({ uri, patterns: input.excludePatterns })) {
        stats.excluded++;
        continue;
      }

      tabs.push({ tab, uri, lastAccess });
    }
  }

  // sort by last access descending (most recent first)
  // tabs with lastAccess=0 (untracked/newly opened) are treated as most recent
  return {
    stats,
    tabs: tabs.sort((a, b) => {
      // treat 0 as "most recent" so newly opened tabs stay open
      const aTime = a.lastAccess === 0 ? Infinity : a.lastAccess;
      const bTime = b.lastAccess === 0 ? Infinity : b.lastAccess;
      return bTime - aTime;
    }),
  };
};
