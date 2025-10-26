// @ts-check
import baseConfig from './base.js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import unusedImports from 'eslint-plugin-unused-imports'
import perfectionist from 'eslint-plugin-perfectionist'
import security from 'eslint-plugin-security'

export const initNestJsEslint = (tsconfigRootDir) => {
  return tseslint.config(
    {
      ignores: ['eslint.config.mjs'],
    },
    ...baseConfig,
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

      plugins: {
        '@stylistic': stylistic,
        'simple-import-sort': simpleImportSort,
        'unused-imports': unusedImports,
        perfectionist,
        security
      }
    },
    {
      rules: {
        '@stylistic/indent': [
          'error',
          2,
          {
            SwitchCase: 1,
            VariableDeclarator: 1,
            MemberExpression: 1,
          },
        ],
        '@stylistic/linebreak-style': ['error', 'unix'],
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
        '@stylistic/semi': [
          'error',
          'never',
          {
            beforeStatementContinuationChars: 'always',
          },
        ],
        '@stylistic/max-len': [
          'error',
          {
            code: 160,
            ignoreUrls: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
            ignoreRegExpLiterals: true,
            ignoreComments: true
          },
        ],
        '@stylistic/arrow-parens': ['error', 'as-needed'],
        '@stylistic/object-curly-spacing': ['error', 'always'],
        '@stylistic/block-spacing': ['error', 'always'],
        '@stylistic/array-bracket-spacing': ['error', 'never'],
        '@stylistic/no-trailing-spaces': 'error',
        '@stylistic/eol-last': ['error', 'always'],
        '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
        '@stylistic/operator-linebreak': ['error', 'before'],
        '@stylistic/comma-spacing': ['error', { before: false, after: true }],
        '@stylistic/key-spacing': ['error', { beforeColon: false, afterColon: true }],
        '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],

        // eslint-plugin-simple-import-sort
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',

        // eslint-plugin-unused-imports
        'unused-imports/no-unused-imports': 'warn',

        // eslint-plugin-perfectionist
        'perfectionist/sort-objects': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-classes': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-interfaces': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-enums': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-object-types': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-variable-declarations': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-union-types': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-intersection-types': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-decorators': ['warn', { order: 'asc', type: 'natural' }],
        'perfectionist/sort-heritage-clauses': ['warn', { order: 'asc', type: 'natural' }],

        // eslint-plugin-security
        ...security.configs.recommended.rules,
      },
    },
  )
}
