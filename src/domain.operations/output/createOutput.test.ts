import { given, when, then } from 'test-fns';

import { createOutput } from './createOutput';

describe('createOutput', () => {
  given('output is enabled', () => {
    when('createOutputChannel is provided', () => {
      then('creates output channel', () => {
        const appendedLines: string[] = [];
        const mockChannel = {
          appendLine: jest.fn((line: string) => appendedLines.push(line)),
          show: jest.fn(),
          dispose: jest.fn(),
        };
        const createOutputChannel = jest.fn(() => mockChannel);

        const output = createOutput({
          enabled: true,
          createOutputChannel,
        });

        expect(createOutputChannel).toHaveBeenCalledWith('bhouncer');
        expect(output.config.outputChannel).toBe(mockChannel);
      });

      then('info logs to both console and channel', () => {
        const appendedLines: string[] = [];
        const mockChannel = {
          appendLine: jest.fn((line: string) => appendedLines.push(line)),
          show: jest.fn(),
          dispose: jest.fn(),
        };
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const output = createOutput({
          enabled: true,
          createOutputChannel: () => mockChannel,
        });

        output.info('test message', { key: 'value' });

        expect(consoleSpy).toHaveBeenCalled();
        expect(appendedLines.length).toBe(1);
        expect(appendedLines[0]).toContain('[INFO]');
        expect(appendedLines[0]).toContain('test message');
        expect(appendedLines[0]).toContain('"key":"value"');

        consoleSpy.mockRestore();
      });

      then('error logs to console.error and channel', () => {
        const appendedLines: string[] = [];
        const mockChannel = {
          appendLine: jest.fn((line: string) => appendedLines.push(line)),
          show: jest.fn(),
          dispose: jest.fn(),
        };
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const output = createOutput({
          enabled: true,
          createOutputChannel: () => mockChannel,
        });

        output.error('error message');

        expect(consoleSpy).toHaveBeenCalled();
        expect(appendedLines.length).toBe(1);
        expect(appendedLines[0]).toContain('[ERROR]');
        expect(appendedLines[0]).toContain('error message');

        consoleSpy.mockRestore();
      });

      then('dispose cleans up output channel', () => {
        const mockChannel = {
          appendLine: jest.fn(),
          show: jest.fn(),
          dispose: jest.fn(),
        };

        const output = createOutput({
          enabled: true,
          createOutputChannel: () => mockChannel,
        });

        output.dispose();

        expect(mockChannel.dispose).toHaveBeenCalled();
        expect(output.config.outputChannel).toBeNull();
      });
    });
  });

  given('output is disabled', () => {
    then('does not create output channel', () => {
      const createOutputChannel = jest.fn();

      const output = createOutput({
        enabled: false,
        createOutputChannel,
      });

      expect(createOutputChannel).not.toHaveBeenCalled();
      expect(output.config.outputChannel).toBeNull();
    });

    then('logs only to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const output = createOutput({ enabled: false });

      output.info('test message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  given('output methods', () => {
    then('warn logs with WARN level', () => {
      const appendedLines: string[] = [];
      const mockChannel = {
        appendLine: jest.fn((line: string) => appendedLines.push(line)),
        show: jest.fn(),
        dispose: jest.fn(),
      };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const output = createOutput({
        enabled: true,
        createOutputChannel: () => mockChannel,
      });

      output.warn('warning message');

      expect(appendedLines[0]).toContain('[WARN]');
      consoleSpy.mockRestore();
    });

    then('debug logs with DEBUG level', () => {
      const appendedLines: string[] = [];
      const mockChannel = {
        appendLine: jest.fn((line: string) => appendedLines.push(line)),
        show: jest.fn(),
        dispose: jest.fn(),
      };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const output = createOutput({
        enabled: true,
        createOutputChannel: () => mockChannel,
      });

      output.debug('debug message');

      expect(appendedLines[0]).toContain('[DEBUG]');
      consoleSpy.mockRestore();
    });
  });
});
