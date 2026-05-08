import baseConfig from '@legal-saas/eslint-config';

export default [
  // Archivos que no pertenecen al proyecto TypeScript
  { ignores: ['eslint.config.mjs', 'dist/**', 'coverage/**', 'vitest.config.ts', 'vitest.e2e.config.ts'] },
  ...baseConfig,
  // NestJS @Module() classes son vacías por diseño (metadata DI)
  {
    files: ['**/*.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
