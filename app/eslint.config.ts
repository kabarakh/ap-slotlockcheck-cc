import { globalIgnores } from 'eslint/config';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import pluginPlaywright from 'eslint-plugin-playwright';
import pluginVitest from '@vitest/eslint-plugin';
import pluginOxlint from 'eslint-plugin-oxlint';
import pluginPerfectionist from 'eslint-plugin-perfectionist';
import skipFormatting from 'eslint-config-prettier/flat';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'src/api/schema.d.ts']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  {
    plugins: { perfectionist: pluginPerfectionist },
    rules: {
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'unsorted',
          groups: ['unknown', 'primevue', 'component', 'own'],
          customGroups: [
            { groupName: 'primevue', elementNamePattern: '^primevue(/|$)' },
            { groupName: 'component', elementNamePattern: '\\.vue$' },
            { groupName: 'own', elementNamePattern: '^(@/|\\.)' },
          ],
          newlinesBetween: 1,
        },
      ],
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
);
