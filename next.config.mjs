import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Enhanced debug helper
const debugModule = (modulePath, context = '') => {
  try {
    const exists = fs.existsSync(modulePath);
    const stats = exists ? fs.statSync(modulePath) : null;
    const isDirectory = stats ? stats.isDirectory() : false;
    console.log(`[DEBUG ${context}] Module path check: ${modulePath}`);
    console.log(`[DEBUG ${context}] - Exists: ${exists}`);
    console.log(`[DEBUG ${context}] - Is Directory: ${isDirectory}`);
    if (exists && !isDirectory) {
      const content = fs.readFileSync(modulePath, 'utf8');
      console.log(`[DEBUG ${context}] - File size: ${content.length} bytes`);
    }
    if (exists && isDirectory) {
      const files = fs.readdirSync(modulePath);
      console.log(`[DEBUG ${context}] - Contents: ${files.join(', ')}`);
    }
  } catch (error) {
    console.log(`[DEBUG ${context}] Error checking module: ${modulePath}`);
    console.log(`[DEBUG ${context}] Error details:`, error);
  }
};

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
    serverActions: {
      bodySizeLimit: '2mb'
    },
    optimizePackageImports: ['twitter-api-v2']
  },
  output: 'standalone',
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  // Disable source maps in production
  productionBrowserSourceMaps: false,
  // Simplify the build process
  swcMinify: true,
  poweredByHeader: false,
  compress: true,
  generateEtags: false,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  distDir: '.next',
  // Simplify module resolution
  modularizeImports: {
    'twitter-api-v2': {
      transform: 'twitter-api-v2/dist/{{member}}'
    }
  },
  webpack: (config, { isServer }) => {
    // Add styled-jsx to the resolve aliases
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        'styled-jsx': require.resolve('styled-jsx'),
        'styled-jsx/style': require.resolve('styled-jsx/style')
      }
    };

    // Only handle externals for server-side
    if (isServer) {
      const originalExternals = config.externals;
      config.externals = (ctx, callback) => {
        // Handle styled-jsx modules
        if (ctx.request?.startsWith('styled-jsx')) {
          return callback(null, `commonjs ${ctx.request}`);
        }
        // Use original externals
        if (typeof originalExternals === 'function') {
          return originalExternals(ctx, callback);
        }
        // Default behavior
        callback();
      };
    }

    return config;
  }
}

export default nextConfig 