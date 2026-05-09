import base from '@legal-saas/eslint-config/base.js';

/** @type {import('typescript-eslint').Config} */
export default [
  ...base,

  // Allow config files that live outside the tsconfig include
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.js', 'postcss.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // All TS/TSX files — Next.js specific relaxations
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Next.js App Router uses default exports for pages/layouts
      'import/prefer-default-export': 'off',
      // Server Components can be async without hooks
      '@typescript-eslint/require-await': 'off',
    },
  },

  // React components must use PascalCase — override naming convention for TSX
  {
    files: ['**/*.tsx'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
        { selector: 'objectLiteralProperty', format: null },
      ],
    },
  },

  // shadcn/ui uses React.ElementRef which is deprecated in React 19+ types
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
    },
  },

  // Lucide brand icons (Facebook, Instagram) are deprecated upstream but needed for UX
  {
    files: ['src/components/social-accounts/**/*.tsx', 'src/components/onboarding/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
    },
  },

  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];
