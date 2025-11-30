/**
 * .what = output channel configuration
 * .why = encapsulates vscode output channel for debug mode logging
 */
export interface OutputConfig {
  /** vscode output channel for debug mode */
  outputChannel: {
    appendLine: (message: string) => void;
    show: (preserveFocus?: boolean) => void;
    dispose: () => void;
  } | null;
}

/**
 * .what = creates fresh output config
 * .why = enables clean initialization
 */
export const createOutputConfig = (): OutputConfig => ({
  outputChannel: null,
});
