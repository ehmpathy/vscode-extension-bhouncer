import { execSync } from 'child_process';
import { given, when, then } from 'test-fns';

import { getProcessResources } from './getProcessResources';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as jest.Mock;

describe('getProcessResources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  given('a valid pid', () => {
    when('ps returns valid output', () => {
      then('returns parsed ProcessResourceSnapshot', () => {
        // mock ps output: rss=45678 (KB), cpu=2.3%
        mockExecSync.mockReturnValue('  45678   2.3\n');

        const result = getProcessResources({ pid: 12345 });

        expect(result).not.toBeNull();
        expect(result?.pid).toEqual(12345);
        expect(result?.memoryBytes).toEqual(45678 * 1024); // KB to bytes
        expect(result?.cpuPercent).toEqual(2.3);
        expect(result?.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });

      then('calls ps with correct arguments', () => {
        mockExecSync.mockReturnValue('  1024   0.5\n');

        getProcessResources({ pid: 99999 });

        expect(mockExecSync).toHaveBeenCalledWith(
          'ps -o rss=,pcpu= -p 99999',
          { encoding: 'utf8' },
        );
      });
    });

    when('ps returns output with extra whitespace', () => {
      then('parses correctly', () => {
        mockExecSync.mockReturnValue('    1024    0.0   \n');

        const result = getProcessResources({ pid: 12345 });

        expect(result?.memoryBytes).toEqual(1024 * 1024);
        expect(result?.cpuPercent).toEqual(0.0);
      });
    });

    when('ps returns high cpu percentage', () => {
      then('parses decimal correctly', () => {
        mockExecSync.mockReturnValue('  2048   99.9\n');

        const result = getProcessResources({ pid: 12345 });

        expect(result?.cpuPercent).toEqual(99.9);
      });
    });
  });

  given('an invalid pid', () => {
    when('ps exits with status 1 (not found)', () => {
      then('returns null', () => {
        const error = new Error('ps: No matching processes');
        (error as unknown as { status: number }).status = 1;
        mockExecSync.mockImplementation(() => {
          throw error;
        });

        const result = getProcessResources({ pid: 99999 });

        expect(result).toBeNull();
      });
    });
  });

  given('ps command fails', () => {
    when('ps exits with non-1 status', () => {
      then('throws the error', () => {
        const error = new Error('ps: command failed');
        (error as unknown as { status: number }).status = 2;
        mockExecSync.mockImplementation(() => {
          throw error;
        });

        expect(() => getProcessResources({ pid: 12345 })).toThrow(
          'ps: command failed',
        );
      });
    });
  });

  given('ps returns empty output', () => {
    when('output has no parseable data', () => {
      then('returns null', () => {
        mockExecSync.mockReturnValue('   \n');

        const result = getProcessResources({ pid: 12345 });

        expect(result).toBeNull();
      });
    });
  });
});
