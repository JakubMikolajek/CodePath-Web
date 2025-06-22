// @ts-check
import eslint from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import importPlugin from 'eslint-plugin-import'
import { config as baseConfig } from './base.js'
import stylistic from '@stylistic/eslint-plugin'

export const initNextJsEslint = () => {
  return [
    eslint.configs.recommended,
    ...baseConfig,

    {
      plugins: { stylistic },
      rules: {
        'stylistic/semi': ['error', 'never'],
        'stylistic/quotes': ['error', 'single'],
        'stylistic/comma-dangle': ['error', 'always-multiline'],
        'stylistic/indent': ['error', 2],
        'stylistic/no-trailing-spaces': 'error',
        'stylistic/eol-last': ['error', 'always'],
        'stylistic/max-len': ['error', { code: 160, ignoreUrls: true }],
        'stylistic/arrow-parens': ['error', 'always'],
        'stylistic/object-curly-spacing': ['error', 'always'],
        'stylistic/array-bracket-spacing': ['error', 'never'],
      }
    },

    {
      plugins: {
        react: pluginReact,
        'react-hooks': pluginReactHooks,
        '@next/next': nextPlugin,
      },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
        '@next/next/no-html-link-for-pages': 'off',
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

    {
      ignores: ['.next/', 'src/components/ui/**'],
    },

    {
      files: ['next.config.js', 'postcss.config.mjs', 'tailwind.config.js'],
      languageOptions: {
        parser: '@typescript-eslint/parser',
        parserOptions: {
          project: './tsconfig.json',
          sourceType: 'module',
        },
        globals: {
          module: true,
          require: true,
        },
      },
    },
  ]
}
