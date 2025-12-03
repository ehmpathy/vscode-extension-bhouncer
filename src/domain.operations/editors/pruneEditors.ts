import Bottleneck from 'bottleneck';
import * as vscode from 'vscode';

import type { ExtensionState } from '../../domain.objects/ExtensionState';
import { checkAndUpdateLanguageServers } from '../servers/checkAndUpdateLanguageServers';
import { getEligibleTabsForPruning } from './getEligibleTabsForPruning';
import { selectTabsToClose } from './selectTabsToClose';

// limiter ensures only one prune runs at a time, drops overflow to prevent queue buildup
const limiter = new Bottleneck({
  maxConcurrent: 1,
  highWater: 1,
  strategy: Bottleneck.strategy.OVERFLOW,
});

/**
 * .what = prunes stale editors based on idle time and count limits
 * .why = reduces memory by closing editors that haven't been used recently
 */
export const pruneEditors = (context: { state: ExtensionState }): Promise<void> =>
  limiter.schedule(async () => {
    try {
    const config = vscode.workspace.getConfiguration('bhouncer');
    const enabled = config.get<boolean>('enabled', true);

    // skip if bhouncer is disabled
    if (!enabled) return;

    // load pruning settings
    const maxOpen = config.get<number>('editors.maxOpen', 10);
    const idleTimeoutMs =
      config.get<number>('editors.idleTimeoutMinutes', 10) * 60 * 1000;
    const excludePatterns = config.get<string[]>(
      'editors.excludePatterns',
      [],
    );
    const excludePinned = config.get<boolean>('editors.excludePinned', true);
    const excludeDirty = config.get<boolean>('editors.excludeDirty', true);
    const now = Date.now();

    // collect eligible tabs
    const { tabs } = getEligibleTabsForPruning({
      editorLastAccess: context.state.editorLastAccess,
      excludePatterns,
      excludePinned,
      excludeDirty,
    });

    // select tabs that should be closed
    const tabsToClose = selectTabsToClose({
      tabs,
      maxOpen,
      idleTimeoutMs,
      now,
    });

    // skip if no tabs to close
    if (tabsToClose.length === 0) return;

    // build toClose with reasons inline
    const toClose = tabs
      .map((t, i) => {
        const isOverLimit = i >= maxOpen;
        const isIdle =
          t.lastAccess > 0 && now - t.lastAccess > idleTimeoutMs;
        if (!isOverLimit && !isIdle) return null;
        return {
          path: t.uri,
          reason: isOverLimit ? 'lru' : 'idle',
          age: Math.round((now - t.lastAccess) / 1000),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // log input state
    context.state.output?.debug('pruneEditors.close.input', {
      open: tabs.length,
      maxOpen,
      toClose,
    });

    // close selected tabs
    const success = await vscode.window.tabGroups.close(tabsToClose);
    context.state.output?.debug('pruneEditors.close.output', {
      success,
      closed: toClose.map((t) => t.path),
    });

    // update language servers after closing (ignore bottleneck drops, rethrow others)
    await checkAndUpdateLanguageServers(context).catch((error) => {
      const isBottleneckDrop =
        error instanceof Error &&
        error.message.includes('dropped by Bottleneck');
      if (!isBottleneckDrop) throw error;
    });
  } catch (error) {
    context.state.output?.warn('pruneEditors.error', {
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
    });
  }
  });
