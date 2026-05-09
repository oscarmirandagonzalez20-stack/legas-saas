'use strict';

/**
 * Why this file exists:
 * NestJS uses webpack to bundle the API + workspace TypeScript packages
 * (@legal-saas/meta-sdk has main: "./src/index.ts" — pure TS, no precompile).
 *
 * Why ts-loader was replaced with swc-loader:
 * pnpm isolated nodelinker encodes ALL peer-deps in the virtual store path:
 *   ts-loader@9.5.7_typescript@5.7.2_webpack@5.97.1_@swc+core@1.15.33_/
 * Docker COPY of this symlink chain fails on Railway's BuildKit environment.
 *
 * Fix: require.resolve('swc-loader') uses Node.js native module resolution
 * which correctly follows pnpm symlinks and returns an ABSOLUTE path.
 * webpack receives an absolute path — no loader resolution needed at all.
 * swc-loader has no TypeScript peer-dep → simpler pnpm store path.
 */

module.exports = (options) => {
  // Node.js resolves this from apps/api/node_modules/swc-loader (pnpm symlink).
  // The returned absolute path bypasses webpack's own resolveLoader entirely.
  const swcLoader = require.resolve('swc-loader');

  return {
    ...options,
    module: {
      ...options.module,
      rules: [
        // Drop ts-loader rule injected by NestJS CLI defaults
        ...options.module.rules.filter(
          (rule) => !(rule.test && rule.test.toString().includes('tsx?')),
        ),
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: swcLoader, // absolute path — no resolution by webpack
          },
        },
      ],
    },
  };
};
