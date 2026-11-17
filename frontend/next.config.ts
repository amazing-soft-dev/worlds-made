import type { NextConfig } from 'next';

// Two build targets (see docs/GITHUB-FLOW.md and PLAN.md):
//  - server (default): full app, Next's image optimizer, /api proxied to the backend.
//  - static (NEXT_OUTPUT=export): plain HTML in out/, no server, no /api.
const isStatic = process.env.NEXT_OUTPUT === 'export';

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
  ...(isStatic
    ? {
        output: 'export' as const,
        trailingSlash: true,
        // Replaced by a custom WebP loader in the image pipeline issue.
        images: { unoptimized: true },
      }
    : {
        images: { formats: ['image/avif', 'image/webp'] },
      }),
};

export default nextConfig;
