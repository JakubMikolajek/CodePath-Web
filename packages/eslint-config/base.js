import js from "@eslint/js";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'comma-dangle': ['error', 'never'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'no-empty': 'error',
      'no-multi-spaces': 'error',
      'no-mixed-spaces-and-tabs': 'error',
      'keyword-spacing': ['error', { before: true, after: true }],
      'space-in-parens': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'block-spacing': ['error', 'always'],
      'semi': ['error', 'never'],
      'padded-blocks': ['error', 'never'],
      'arrow-spacing': ['error', { before: true, after: true }],
      'space-infix-ops': ['error', { int32Hint: false }],
      "@typescript-eslint/no-unsafe-argument": 0,
      "@typescript-eslint/prefer-readonly": 0,
      "@typescript-eslint/no-var-requires": 0,
      "@typescript-eslint/prefer-nullish-coalescing": 0,
      "@typescript-eslint/strict-boolean-expressions": 0,
      "@typescript-eslint/restrict-template-expressions": 0,
      "@typescript-eslint/explicit-function-return-type": 0,
      "@typescript-eslint/no-base-to-string": 0,
      "@typescript-eslint/no-dynamic-delete": 0,
      "@typescript-eslint/no-misused-promises": ["error", { "checksVoidReturn": false } ],
      "@typescript-eslint/consistent-type-imports": [ "warn", { "prefer": "type-imports" } ],
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
];
