import { given, when, then } from 'test-fns';

import {
  createMockTab,
  createMockTabGroup,
  resetMocks,
  window,
} from '../../.test/mocks/vscode';
import { hasOpenEditorsWithExtension } from './hasOpenEditorsWithExtension';

describe('hasOpenEditorsWithExtension', () => {
  beforeEach(() => {
    resetMocks();
  });

  given('a set of extensions to check for', () => {
    when('no tabs are open', () => {
      then('returns false', () => {
        window.tabGroups.all = [];

        const result = hasOpenEditorsWithExtension({
          extensions: ['.ts', '.tsx'],
        });

        expect(result).toBe(false);
      });
    });

    when('tabs are open but none match the extensions', () => {
      then('returns false', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/readme.md' }),
            createMockTab({ fsPath: '/project/config.json' }),
          ]),
        ];

        const result = hasOpenEditorsWithExtension({
          extensions: ['.ts', '.tsx'],
        });

        expect(result).toBe(false);
      });
    });

    when('one tab matches an extension', () => {
      then('returns true', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/readme.md' }),
            createMockTab({ fsPath: '/project/src/index.ts' }),
          ]),
        ];

        const result = hasOpenEditorsWithExtension({
          extensions: ['.ts', '.tsx'],
        });

        expect(result).toBe(true);
      });
    });

    when('multiple tabs match extensions', () => {
      then('returns true', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/src/index.ts' }),
            createMockTab({ fsPath: '/project/src/App.tsx' }),
          ]),
        ];

        const result = hasOpenEditorsWithExtension({
          extensions: ['.ts', '.tsx'],
        });

        expect(result).toBe(true);
      });
    });

    when('tabs are spread across multiple tab groups', () => {
      then('checks all groups', () => {
        window.tabGroups.all = [
          createMockTabGroup([createMockTab({ fsPath: '/project/readme.md' })]),
          createMockTabGroup([createMockTab({ fsPath: '/project/src/index.ts' })]),
        ];

        const result = hasOpenEditorsWithExtension({
          extensions: ['.ts', '.tsx'],
        });

        expect(result).toBe(true);
      });
    });

    when('checking terraform extensions', () => {
      then('matches .tf and .tfvars files', () => {
        window.tabGroups.all = [
          createMockTabGroup([
            createMockTab({ fsPath: '/project/main.tf' }),
            createMockTab({ fsPath: '/project/vars.tfvars' }),
          ]),
        ];

        const result = hasOpenEditorsWithExtension({
          extensions: ['.tf', '.tfvars'],
        });

        expect(result).toBe(true);
      });
    });
  });
});
