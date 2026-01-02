import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * .what = findserts bhouncer entries into .vscode/.gitignore
 * .why = ensures state and local settings files are not committed to version control
 */
export const findsertVscodeGitignore = async (input: {
  vscodeDir: string;
}): Promise<void> => {
  const gitignorePath = path.join(input.vscodeDir, '.gitignore');
  const entries = ['.gitignore', 'bhouncer.state.json', 'settings.json'];

  // read current gitignore if present
  const content = await fs
    .readFile(gitignorePath, 'utf8')
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return ''; // file doesn't exist, start fresh
      throw error; // rethrow other errors
    });

  // find entries that need to be added
  const lines = content.split('\n');
  const missingEntries = entries.filter(
    (entry) => !lines.some((line) => line.trim() === entry),
  );
  if (missingEntries.length === 0) return;

  // append entries not yet present, with newline logic
  const needsNewline = content.length > 0 && !content.endsWith('\n');
  const updatedContent =
    content + (needsNewline ? '\n' : '') + missingEntries.join('\n') + '\n';

  // write updated gitignore
  await fs.writeFile(gitignorePath, updatedContent, 'utf8');
};
