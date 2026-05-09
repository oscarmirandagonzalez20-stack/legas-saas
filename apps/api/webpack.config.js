'use strict';

const path = require('path');

/**
 * NestJS CLI passes the default webpack options as first arg.
 * We spread them and override only resolveLoader so webpack finds
 * ts-loader in apps/api/node_modules (pnpm symlink) and the
 * monorepo root virtual store — regardless of the loader resolution
 * context that the CLI sets internally.
 */
module.exports = (options) => ({
  ...options,
  resolveLoader: {
    ...options.resolveLoader,
    modules: [
      path.join(__dirname, 'node_modules'),        // apps/api/node_modules (pnpm symlink to .pnpm store)
      path.join(__dirname, '../../node_modules'),  // monorepo root node_modules
    ],
  },
});
