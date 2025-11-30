/**
 * .what = mock vscode module for unit testing
 * .why = vscode apis are only available in extension host, need mocks for unit tests
 */

// reset function to clear all mocks between tests
export const resetMocks = (): void => {
  window.tabGroups.all = [];
  window.tabGroups.close.mockClear();
  window.tabGroups.onDidChangeTabs.mockClear();
  window.activeTextEditor = undefined;
  window.onDidChangeActiveTextEditor.mockClear();
  window.showInformationMessage.mockClear();
  window.showWarningMessage.mockClear();
  window.createOutputChannel.mockClear();
  workspace.getConfiguration.mockClear();
  commands.registerCommand.mockClear();
  commands.executeCommand.mockClear();
};

export const window = {
  tabGroups: {
    all: [] as unknown[],
    close: jest.fn(),
    onDidChangeTabs: jest.fn(() => ({ dispose: jest.fn() })),
  },
  activeTextEditor: undefined as unknown,
  onDidChangeActiveTextEditor: jest.fn(() => ({ dispose: jest.fn() })),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  })),
};

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  })),
  workspaceFolders: [
    { uri: { fsPath: '/mock/workspace' }, name: 'workspace', index: 0 },
  ],
};

export const commands = {
  registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
  executeCommand: jest.fn(),
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};

export class TabInputText {
  constructor(public uri: { fsPath: string; toString: () => string }) {}
}

/**
 * .what = helper to create mock tabs for testing
 * .why = reduces boilerplate in tests that need to mock tab structures
 */
export const createMockTab = (input: {
  fsPath: string;
  isPinned?: boolean;
  isDirty?: boolean;
}): { input: TabInputText; isPinned: boolean; isDirty: boolean } => ({
  input: new TabInputText({
    fsPath: input.fsPath,
    toString: () => `file://${input.fsPath}`,
  }),
  isPinned: input.isPinned ?? false,
  isDirty: input.isDirty ?? false,
});

/**
 * .what = helper to create mock tab group for testing
 * .why = simplifies setting up window.tabGroups.all in tests
 */
export const createMockTabGroup = (
  tabs: ReturnType<typeof createMockTab>[],
): { tabs: ReturnType<typeof createMockTab>[] } => ({ tabs });
