import baseConfig from "@workspace/eslint-config/base";

export default [
  ...baseConfig,
  {
    ignores: ["apps/**", "packages/**"],
    languageOptions: {
      parserOptions: {
        project: true,
      },
    },
  },
];
