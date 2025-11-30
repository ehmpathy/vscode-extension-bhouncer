import { createOutputConfig, type OutputConfig } from '../../domain.objects/Output';

/**
 * .what = output instance with logging methods
 * .why = provides structured logging interface for extension
 */
export interface Output {
  config: OutputConfig;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
  dispose: () => void;
}

/**
 * .what = formats a log line with timestamp and level
 * .why = consistent format for output
 */
const formatLine = (input: {
  level: string;
  message: string;
  data?: Record<string, unknown>;
}): string => {
  const timestamp = new Date().toISOString();
  const dataStr = input.data ? ` ${JSON.stringify(input.data)}` : '';
  return `[${timestamp}] [${input.level.toUpperCase()}] ${input.message}${dataStr}`;
};

/**
 * .what = creates an output instance for the extension
 * .why = enables structured logging to vscode output panel
 */
export const createOutput = (input: {
  enabled: boolean;
  createOutputChannel?: (name: string) => {
    appendLine: (message: string) => void;
    show: (preserveFocus?: boolean) => void;
    dispose: () => void;
  };
}): Output => {
  const config = createOutputConfig();

  // initialize output channel if enabled
  if (input.enabled && input.createOutputChannel) {
    config.outputChannel = input.createOutputChannel('bhouncer');
    // show the output channel so users can see logs immediately
    config.outputChannel.show(true); // preserveFocus=true keeps editor focused
  }

  // log writing helper
  const writeLog = (
    level: string,
    message: string,
    data?: Record<string, unknown>,
  ): void => {
    const formatted = formatLine({ level, message, data });

    // always log to console
    const consoleMethod = level === 'error' ? console.error : console.log;
    consoleMethod(`[bhouncer] ${formatted}`);

    // write to output channel if enabled
    if (config.outputChannel) {
      config.outputChannel.appendLine(formatted);
    }
  };

  return {
    config,
    info: (message, data) => writeLog('info', message, data),
    warn: (message, data) => writeLog('warn', message, data),
    error: (message, data) => writeLog('error', message, data),
    debug: (message, data) => writeLog('debug', message, data),
    dispose: () => {
      if (config.outputChannel) {
        config.outputChannel.dispose();
        config.outputChannel = null;
      }
    },
  };
};
