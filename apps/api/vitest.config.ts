import { fileURLToPath } from 'url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2021',
        keepClassNames: true,
      },
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@legal-saas/meta-sdk': fileURLToPath(new URL('../../packages/meta-sdk/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.module.ts'],
    },
  },
});
