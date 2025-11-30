import { given, when, then } from 'test-fns';

import {
  createMockTab,
  createMockTabGroup,
  resetMocks,
  window,
} from '../../.test/mocks/vscode';
import { getOpenEditorsByExtension } from './getOpenEditorsByExtension';

describe('getOpenEditorsByExtension', () => {
  beforeEach(() => {
    resetMocks();
  });

  given('open editors with various extensions', () => {
    when('multiple typescript files are open', () => {
      then('counts each extension separately', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/a.ts' }),
            createMockTab({ fsPath: '/project/b.ts' }),
            createMockTab({ fsPath: '/project/c.tsx' }),
          ]),
        ];

        const result = getOpenEditorsByExtension({
          extensions: ['.ts', '.tsx', '.js'],
        });

        expect(result).toEqual({
          '.ts': 2,
          '.tsx': 1,
          '.js': 0,
        });
      });
    });

    when('no matching files are open', () => {
      then('returns zero counts', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/readme.md' }),
          ]),
        ];

        const result = getOpenEditorsByExtension({
          extensions: ['.ts', '.tsx'],
        });

        expect(result).toEqual({
          '.ts': 0,
          '.tsx': 0,
        });
      });
    });

    when('tabs across multiple groups', () => {
      then('counts all tabs', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/a.tf' }),
          ]),
          createMockTabGroup([
            createMockTab({ fsPath: '/project/b.tf' }),
            createMockTab({ fsPath: '/project/c.tfvars' }),
          ]),
        ];

        const result = getOpenEditorsByExtension({
          extensions: ['.tf', '.tfvars'],
        });

        expect(result).toEqual({
          '.tf': 2,
          '.tfvars': 1,
        });
      });
    });

    when('no tabs are open', () => {
      then('returns zero counts for all extensions', () => {
        window.tabGroups.all = [];

        const result = getOpenEditorsByExtension({
          extensions: ['.ts', '.js'],
        });

        expect(result).toEqual({
          '.ts': 0,
          '.js': 0,
        });
      });
    });
  });
});
