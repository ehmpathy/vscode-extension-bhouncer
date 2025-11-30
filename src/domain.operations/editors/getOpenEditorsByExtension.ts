import * as vscode from 'vscode';

/**
 * .what = counts open editors grouped by file extension
 * .why = provides detailed breakdown for language server decision logging
 */
export const getOpenEditorsByExtension = (input: {
  extensions: string[];
}): Record<string, number> => {
  // flatten all tabs across all tab groups
  const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

  // count editors per extension
  const counts: Record<string, number> = {};
  for (const ext of input.extensions) {
    counts[ext] = 0;
  }

  for (const tab of allTabs) {
    if (!(tab.input instanceof vscode.TabInputText)) continue;

    const fsPath = tab.input.uri.fsPath;
    for (const ext of input.extensions) {
      if (fsPath.endsWith(ext)) {
        counts[ext] = (counts[ext] ?? 0) + 1;
        break;
      }
    }
  }

  return counts;
};
