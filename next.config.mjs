import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Debug helper
const debugModule = (modulePath) => {
  try {
    const exists = fs.existsSync(modulePath);
    const stats = exists ? fs.statSync(modulePath) : null;
    const isDirectory = stats ? stats.isDirectory() : false;
    console.log(`[DEBUG] Module path check: ${modulePath}`);
    console.log(`[DEBUG] - Exists: ${exists}`);
    console.log(`[DEBUG] - Is Directory: ${isDirectory}`);
    if (exists) {
      const files = fs.readdirSync(modulePath);
      console.log(`[DEBUG] - Contents: ${files.join(', ')}`);
    }
  } catch (error) {
    console.log(`[DEBUG] Error checking module: ${modulePath}`);
    console.log(`[DEBUG] Error details:`, error);
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
    }
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
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      Object.assign(config.resolve.alias, {
        'next/error': 'next/dist/pages/_error',
      });
    }
    if (isServer) {
      config.externals = [
        ...config.externals,
        'styled-jsx',
        'styled-jsx/style'
      ];
    }
    return config;
  }
}

export default nextConfig 