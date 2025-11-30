import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import { checkAndUpdateLanguageServers } from '../servers/checkAndUpdateLanguageServers';
import { getEligibleTabsForPruning } from './getEligibleTabsForPruning';
import { selectTabsToClose } from './selectTabsToClose';

/**
 * .what = prunes stale editors based on idle time and count limits
 * .why = reduces memory by closing editors that haven't been used recently
 */
export const pruneEditors = async (context: {
  state: ExtensionState;
}): Promise<void> => {
  const config = vscode.workspace.getConfiguration('bhouncer');
  const enabled = config.get<boolean>('enabled', true);

  // skip if bhouncer is disabled
  if (!enabled) return;

  // load pruning settings
  const maxOpen = config.get<number>('editors.maxOpen', 10);
  const idleTimeoutMs =
    config.get<number>('editors.idleTimeoutMinutes', 10) * 60 * 1000;
  const excludePatterns = config.get<string[]>('editors.excludePatterns', []);
  const excludePinned = config.get<boolean>('editors.excludePinned', true);
  const excludeDirty = config.get<boolean>('editors.excludeDirty', true);
  const now = Date.now();

  // collect eligible tabs
  const { tabs, stats } = getEligibleTabsForPruning({
    editorLastAccess: context.state.editorLastAccess,
    excludePatterns,
    excludePinned,
    excludeDirty,
  });

  // log input state
  context.state.output?.debug('pruneEditors.input', {
    totalTabs: stats.total,
    eligibleTabs: tabs.length,
    filtered: {
      nonText: stats.nonText,
      pinned: stats.pinned,
      dirty: stats.dirty,
      excluded: stats.excluded,
    },
    maxOpen,
    idleTimeoutMinutes: idleTimeoutMs / 60_000,
    overLimit: Math.max(0, tabs.length - maxOpen),
  });

  // select tabs that should be closed
  const tabsToClose = selectTabsToClose({
    tabs,
    maxOpen,
    idleTimeoutMs,
    now,
  });

  // close selected tabs and update language servers
  if (tabsToClose.length > 0) {
    context.state.output?.debug('pruneEditors.output onClose', {
      closed: {
        quant: tabsToClose.length,
        deets: tabsToClose
      }
    });
    await vscode.window.tabGroups.close(tabsToClose);
    await checkAndUpdateLanguageServers(context);
  }
};
