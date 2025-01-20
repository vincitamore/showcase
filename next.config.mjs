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
    },
    // Enable verbose logging
    logging: {
      level: 'verbose',
      fullUrl: true
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
  webpack: (config, { isServer, dev }) => {
    // Debug webpack configuration
    console.log(`[DEBUG] Webpack config for ${isServer ? 'server' : 'client'}`);
    console.log('[DEBUG] Node modules directory:', join(__dirname, 'node_modules'));
    
    if (isServer) {
      try {
        // Debug styled-jsx resolution
        const styledJsxPath = require.resolve('styled-jsx');
        const styledJsxDir = dirname(styledJsxPath);
        console.log('[DEBUG] styled-jsx resolved path:', styledJsxPath);
        console.log('[DEBUG] styled-jsx directory:', styledJsxDir);
        debugModule(styledJsxDir);
        
        // Add verbose resolution aliases
        config.resolve.alias = {
          ...config.resolve.alias,
          'styled-jsx': styledJsxPath,
          'styled-jsx/package.json': join(styledJsxDir, 'package.json')
        };

        // Debug final config
        console.log('[DEBUG] Final resolve.alias:', config.resolve.alias);
        console.log('[DEBUG] Final resolve.modules:', config.resolve.modules);

        // Add a resolver plugin for debugging
        config.plugins.push({
          apply: (compiler) => {
            compiler.hooks.normalModuleFactory.tap('DebugResolver', (nmf) => {
              nmf.hooks.beforeResolve.tap('DebugResolver', (resolve) => {
                if (resolve.request.includes('styled-jsx')) {
                  console.log('[DEBUG] Resolving:', resolve.request);
                  console.log('[DEBUG] Context:', resolve.context);
                }
                return resolve;
              });
            });
          }
        });
      } catch (error) {
        console.log('[DEBUG] Error in webpack config:', error);
      }
    }
    return config;
  }
}

export default nextConfig 