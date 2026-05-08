import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Clerk domains needed in CSP connect-src / script-src
const CLERK_HOSTS = [
  'https://clerk.browser.dev',
  'https://*.clerk.accounts.dev',
  'https://api.clerk.dev',
  'https://clerk.shared-signals.com',
];

const securityHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // HSTS only sent in production; browsers ignore it on plain HTTP
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
    : []),
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js App Router injects inline scripts during hydration
      `script-src 'self' 'unsafe-inline' ${CLERK_HOSTS.join(' ')}`,
      // Tailwind v4 and Radix UI use inline styles
      "style-src 'self' 'unsafe-inline'",
      // Images: self + data URIs + Meta CDN + Clerk avatars
      "img-src 'self' data: https://img.clerk.com https://graph.facebook.com https://*.cdninstagram.com",
      // API calls + Clerk SDK communication
      `connect-src 'self' ${CLERK_HOSTS.join(' ')}`,
      // Clerk OAuth iframes
      `frame-src ${CLERK_HOSTS.join(' ')}`,
      "font-src 'self'",
      // Prevent plugin embedding (PDF, Flash, etc.)
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Standalone output for Docker / Railway — Vercel ignores this and uses its own optimization
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),

  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'graph.facebook.com' },
      { protocol: 'https', hostname: '*.cdninstagram.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Only upload source maps when SENTRY_AUTH_TOKEN is set (production deploys)
  silent: !process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  sourcemaps: {
    // Skip upload in dev / CI — set SENTRY_AUTH_TOKEN in production deploy only
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Minimal bundle impact: tree-shake unused Sentry integrations
  widenClientFileUpload: false,
  hideSourceMaps: true,
  automaticVercelMonitors: false,
});
