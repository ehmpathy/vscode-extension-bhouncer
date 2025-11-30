/**
 * .what = configuration for a managed language server
 * .why = defines the relationship between file extensions, vscode settings, and process patterns
 */
export interface LanguageServerConfig {
  /** file extensions that trigger this server (e.g., ['.tf', '.tfvars']) */
  extensions: string[];

  /** vscode setting key to enable/disable (e.g., 'terraform.languageServer.enable') */
  settingKey: string;

  /** process name pattern for pid detection (e.g., 'terraform-ls') */
  processPattern: string;
}
