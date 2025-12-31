/**
 * .what = user-facing configuration for a managed language server
 * .why = defines the relationship between file extensions and process patterns
 * .note = control details (mode, settingKey, restartCommand) are looked up from registry by slug
 */
export interface LanguageServerConfig {
  /** unique identifier for this server (e.g., 'typescript', 'terraform') */
  slug: string;

  /** file extensions that trigger this server (e.g., ['.tf', '.tfvars']) */
  extensions: string[];

  /** process name pattern for pid detection (e.g., 'tsserver', 'terraform-ls') */
  processPattern: string;
}
