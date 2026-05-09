import baseConfig from '@legal-saas/eslint-config';

export default [
  // Archivos que no pertenecen al proyecto TypeScript
  { ignores: ['eslint.config.mjs', 'dist/**', 'coverage/**', 'vitest.config.ts', 'vitest.e2e.config.ts'] },
  ...baseConfig,
  // Allow files outside tsconfig include (seed.ts lives in prisma/, not src/)
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['prisma/seed.ts'],
        },
      },
    },
  },
  // Seed is a CLI script — console output is intentional
  {
    files: ['prisma/seed.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // NestJS @Module() classes son vacías por diseño (metadata DI)
  {
    files: ['**/*.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
