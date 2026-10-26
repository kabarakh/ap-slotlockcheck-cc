import { globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import pluginOxlint from 'eslint-plugin-oxlint';
import pluginPerfectionist from 'eslint-plugin-perfectionist';
import skipFormatting from 'eslint-config-prettier/flat';
import globals from 'globals';

export default tseslint.config(
  globalIgnores(['dist/**', 'coverage/**', 'src/generated/**']),
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    plugins: { perfectionist: pluginPerfectionist },
    rules: {
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'unsorted',
          groups: ['unknown', 'own'],
          customGroups: [{ groupName: 'own', elementNamePattern: '^\\.' }],
          newlinesBetween: 1,
        },
      ],
    },
  },
  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),
  skipFormatting,
);
