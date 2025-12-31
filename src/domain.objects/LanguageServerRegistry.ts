import * as vscode from 'vscode';

/**
 * .what = hook context passed to onStart/onPrune handlers
 * .why = provides vscode API access for server control
 */
export interface LanguageServerHookContext {
  vscode: typeof vscode;
}

/**
 * .what = registry entry defining how to start and stop a language server
 * .why = enables server-specific control behavior via hooks
 */
export interface LanguageServerRegistryEntry {
  /**
   * .what = called when starting the server (relevant file opened)
   * .why = enables server-specific startup behavior
   */
  onStart: (context: LanguageServerHookContext) => Promise<void>;

  /**
   * .what = called when pruning the server (no relevant files open)
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
};
