import * as fs from 'fs/promises';
import * as path from 'path';
import { given, then, when } from 'test-fns';

import { findsertVscodeGitignore } from './findsertVscodeGitignore';

// mock fs/promises module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('findsertVscodeGitignore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  given('a .vscode directory', () => {
    const vscodeDir = '/mock/workspace/.vscode';

    when('no .gitignore exists', () => {
      beforeEach(() => {
        const error = new Error('ENOENT: no such file or directory');
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        mockFs.readFile.mockRejectedValue(error);
        mockFs.writeFile.mockResolvedValue();
      });

      then('creates .gitignore with all entries', async () => {
        await findsertVscodeGitignore({ vscodeDir });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          path.join(vscodeDir, '.gitignore'),
          'bhouncer.state.json\nsettings.json\n',
          'utf8',
        );
      });
    });

    when('.gitignore exists but does not contain any entries', () => {
      beforeEach(() => {
        mockFs.readFile.mockResolvedValue('other.txt\n');
        mockFs.writeFile.mockResolvedValue();
      });

      then('appends all entries', async () => {
        await findsertVscodeGitignore({ vscodeDir });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          path.join(vscodeDir, '.gitignore'),
          'other.txt\nbhouncer.state.json\nsettings.json\n',
          'utf8',
        );
      });
    });

    when('.gitignore exists without trailing newline', () => {
      beforeEach(() => {
        mockFs.readFile.mockResolvedValue('other.json');
        mockFs.writeFile.mockResolvedValue();
      });

      then('adds newline before appending entries', async () => {
        await findsertVscodeGitignore({ vscodeDir });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          path.join(vscodeDir, '.gitignore'),
          'other.json\nbhouncer.state.json\nsettings.json\n',
          'utf8',
        );
      });
    });

    when('.gitignore already contains all entries', () => {
      beforeEach(() => {
        mockFs.readFile.mockResolvedValue(
          'other.json\nbhouncer.state.json\nsettings.json\n',
        );
        mockFs.writeFile.mockResolvedValue();
      });

      then('does not write (idempotent)', async () => {
        await findsertVscodeGitignore({ vscodeDir });

        expect(mockFs.writeFile).not.toHaveBeenCalled();
      });
    });

    when('.gitignore contains only bhouncer.state.json', () => {
      beforeEach(() => {
        mockFs.readFile.mockResolvedValue('bhouncer.state.json\n');
        mockFs.writeFile.mockResolvedValue();
      });

      then('appends only missing settings.json', async () => {
        await findsertVscodeGitignore({ vscodeDir });

        expect(mockFs.writeFile).toHaveBeenCalledWith(
          path.join(vscodeDir, '.gitignore'),
          'bhouncer.state.json\nsettings.json\n',
          'utf8',
        );
      });
    });

    when('.gitignore contains entries with extra whitespace', () => {
      beforeEach(() => {
        mockFs.readFile.mockResolvedValue(
          'other.json\n  bhouncer.state.json  \n  settings.json  \n',
        );
        mockFs.writeFile.mockResolvedValue();
      });

      then('recognizes trimmed entries and does not duplicate', async () => {
        await findsertVscodeGitignore({ vscodeDir });

        expect(mockFs.writeFile).not.toHaveBeenCalled();
      });
    });
  });
});
