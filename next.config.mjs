import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    // Ensure proper module resolution
    esmExternals: 'loose',
    // Bundle styled-jsx with the server code
    serverActions: {
      bodySizeLimit: '2mb'
    },
    // Disable build traces collection
    outputFileTracingRoot: undefined,
    outputFileTracingExcludes: {
      '*': [
        'node_modules/**/*',
        '**/*.json',
        '**/*.d.ts'
      ]
    }
  },
  output: 'standalone',
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  // Simplify the build process
  swcMinify: true,
  poweredByHeader: false,
  compress: true,
  generateEtags: false,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  distDir: '.next',
  webpack: (config, { isServer }) => {
    // Prevent styled-jsx from being externalized
    if (isServer) {
      const originalExternals = [...config.externals];
      config.externals = [
        (ctx, req, cb) => {
          if (req.startsWith('styled-jsx')) {
            return cb(null, false);
          }
          if (typeof originalExternals[0] === 'function') {
            return originalExternals[0](ctx, req, cb);
          }
          return cb(null, true);
        },
        ...(Array.isArray(originalExternals) ? originalExternals.slice(1) : [])
      ];
    }

    return config;
  }
}

export default nextConfig 