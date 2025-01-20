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
    optimizePackageImports: ['twitter-api-v2'],
    logging: {
      level: 'verbose',
      fullUrl: true,
    },
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
  // Static export configuration
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  // Disable server features in production
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    }
  },
  // Enable detailed logging
  onError: function (err) {
    console.error('Next.js Build Error:', err);
    return err;
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

export default nextConfig 