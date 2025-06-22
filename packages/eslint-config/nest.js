// @ts-check
import { config as baseConfig } from './base.js'
import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import importPlugin from 'eslint-plugin-import'

export const initNestJsEslint = (tsconfigRootDir) => {
  return tseslint.config(
    {
      ignores: ['eslint.config.mjs'],
    },
    ...baseConfig,
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    stylistic.configs.customize({
      indent: 2,
      quotes: 'single',
      semi: false,
      arrowParens: false,
    }),
    {
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.jest,
        },
        ecmaVersion: 5,
        sourceType: 'module',
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
    },
    {
      plugins: {
        import: importPlugin,
      },
      rules: {
        'import/order': [
          'error',
          {
            groups: [
              'builtin',
              'external',
              'internal',
              'parent',
              'sibling',
              'index',
            ],
            'newlines-between': 'always',
            alphabetize: {
              order: 'asc',
              caseInsensitive: true,
            },
          },
        ],
        'import/no-duplicates': 'error',
      },
    },
  )
}
