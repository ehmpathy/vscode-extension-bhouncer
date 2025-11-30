import type * as vscode from 'vscode';

/**
 * .what = information about an editor tab with access tracking
 * .why = enables sorting and filtering tabs by last access time for pruning
 */
export interface EditorTabInfo {
  /** the vscode tab reference */
  tab: vscode.Tab;

  /** uri string of the document */
  uri: string;

  /** timestamp of last access (0 if never accessed) */
  lastAccess: number;
}
