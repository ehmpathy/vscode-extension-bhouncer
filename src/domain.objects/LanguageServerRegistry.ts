import * as vscode from 'vscode';

/**
 * .what = hook context passed to onStart/onPrune handlers
 * .why = provides vscode API access for server control
 */
export interface LanguageServerHookContext {
  vscode: typeof vscode;
}

/**
 * .what = registry entry defining how to start, stop, and detect a language server
 * .why = centralizes server-specific control behavior and detection
 */
export interface LanguageServerRegistryEntry {
  /**
   * .what = process name pattern for pid detection
   * .why = enables detection of server via pgrep
   */
  processPattern: string;

  /**
   * .what = called on server start (relevant file opened)
   * .why = enables server-specific startup behavior
   */
  onStart: (context: LanguageServerHookContext) => Promise<void>;

  /**
   * .what = called on server prune (no relevant files open)
   * .why = enables server-specific shutdown behavior before pid kill
   */
  onPrune: (context: LanguageServerHookContext) => Promise<void>;
}

/**
 * .what = registry of known language servers and their control hooks
 * .why = enables internal lookup of how to start/stop each server by slug
 */
export const LANGUAGE_SERVER_REGISTRY: Record<
  string,
  LanguageServerRegistryEntry
> = {
  // terraform language server - controlled via setting
  terraform: {
    processPattern: 'terraform-ls',
    onStart: async (context) => {
      const config = context.vscode.workspace.getConfiguration(
        'terraform.languageServer',
      );
      await config.update(
        'enable',
        true,
        context.vscode.ConfigurationTarget.Workspace,
      );
    },
    onPrune: async (context) => {
      const config = context.vscode.workspace.getConfiguration(
        'terraform.languageServer',
      );
      await config.update(
        'enable',
        false,
        context.vscode.ConfigurationTarget.Workspace,
      );
    },
  },

  // typescript language server - controlled via command
  typescript: {
    processPattern: 'tsserver',
    onStart: async (context) => {
      await context.vscode.commands.executeCommand(
        'typescript.restartTsServer',
      );
    },
    onPrune: async () => {
      // no action needed - pid kill is handled separately
    },
  },

  // eslint language server - controlled via setting
  eslint: {
    processPattern: 'eslint',
    onStart: async (context) => {
      const config = context.vscode.workspace.getConfiguration('eslint');
      await config.update(
        'enable',
        true,
        context.vscode.ConfigurationTarget.Workspace,
      );
    },
    onPrune: async (context) => {
      const config = context.vscode.workspace.getConfiguration('eslint');
      await config.update(
        'enable',
        false,
        context.vscode.ConfigurationTarget.Workspace,
      );
    },
  },

  // yaml language server - controlled via setting
  yaml: {
    processPattern: 'yaml-language-server',
    onStart: async (context) => {
      const config = context.vscode.workspace.getConfiguration('yaml');
      await config.update(
        'validate',
        true,
        context.vscode.ConfigurationTarget.Workspace,
      );
    },
    onPrune: async (context) => {
      const config = context.vscode.workspace.getConfiguration('yaml');
      await config.update(
        'validate',
        false,
        context.vscode.ConfigurationTarget.Workspace,
      );
    },
  },

  // cspell spell checker - controlled via setting
  cspell: {
    processPattern: 'cspell',
    onStart: async (context) => {
      const config = context.vscode.workspace.getConfiguration('cSpell');
      await config.update(
        'enabled',
        true,
        context.vscode.ConfigurationTarget.Workspace,
      );
    },
    onPrune: async (context) => {
      const config = context.vscode.workspace.getConfiguration('cSpell');
      await config.update(
        'enabled',
        false,
        context.vscode.ConfigurationTarget.Workspace,
      );
    },
  },
};
