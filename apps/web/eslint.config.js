import base from '@legal-saas/eslint-config/base.js';

/** @type {import('typescript-eslint').Config} */
export default [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Next.js App Router uses default exports for pages/layouts
      'import/prefer-default-export': 'off',
      // Server Components can be async without hooks
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
];
