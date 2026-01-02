/**
 * .what = user-facing configuration for a managed language server
 * .why = defines which file extensions trigger which server
 * .note = all implementation details (processPattern, hooks) are in the registry
 */
export interface LanguageServerConfig {
  /** unique identifier for this server (e.g., 'typescript', 'terraform') */
  slug: string;

  /** file extensions that trigger this server (e.g., ['.tf', '.tfvars']) */
  extensions: string[];
}
