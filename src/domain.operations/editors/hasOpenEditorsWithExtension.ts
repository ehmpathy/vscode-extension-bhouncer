import * as vscode from 'vscode';

/**
 * .what = checks if any open editor tab has one of the specified file extensions
 * .why = determines whether a language server should be enabled based on open files
 */
export const hasOpenEditorsWithExtension = (input: {
  extensions: string[];
}): boolean => {
  // flatten all tabs across all tab groups
  const allTabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);

  // check if any tab matches any extension
  return allTabs.some((tab) => {
    if (!(tab.input instanceof vscode.TabInputText)) return false;

    const fsPath = tab.input.uri.fsPath;
    return input.extensions.some((ext) => fsPath.endsWith(ext));
  });
};
