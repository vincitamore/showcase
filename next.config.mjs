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
  webpack: (config, { dev, isServer }) => {
    console.log(`[DEBUG] Webpack config building for ${isServer ? 'server' : 'client'} in ${dev ? 'development' : 'production'}`);
    
    // Debug current config state
    console.log('[DEBUG] Initial config state:');
    console.log('- Resolve:', !!config.resolve);
    console.log('- Module rules:', config.module?.rules?.length || 0);
    console.log('- Externals:', typeof config.externals);

    // Ensure we have a resolve object with aliases
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        'styled-jsx': require.resolve('styled-jsx'),
        'styled-jsx/style': require.resolve('styled-jsx/style')
      }
    };

    // Handle externals for server-side
    if (isServer) {
      const originalExternals = config.externals;
      config.externals = (context, request, callback) => {
        // Skip externals for app directory pages and internal Next.js requests
        if (context?.issuer?.includes('/app/') || request.startsWith('next/')) {
          return callback();
        }

        // Handle styled-jsx modules
        if (request.startsWith('styled-jsx')) {
          return callback(null, `commonjs ${request}`);
        }

        // Handle original externals
        if (typeof originalExternals === 'function') {
          return originalExternals(context, request, callback);
        }
        
        if (Array.isArray(originalExternals)) {
          for (const external of originalExternals) {
            if (typeof external === 'function') {
              try {
                return external(context, request, callback);
              } catch (err) {
                console.warn(`[DEBUG] External handler error:`, err);
              }
            }
          }
        }

        // Default behavior
        callback();
      };
    }

    // Add rule for handling styled-jsx
    console.log('[DEBUG] Adding styled-jsx rule');
    config.module.rules.push({
      test: /styled-jsx\/style\.js$/,
      use: [
        {
          loader: 'babel-loader',
          options: {
            presets: ['next/babel'],
            plugins: ['styled-jsx/babel']
          }
        }
      ]
    });

    // Log final config state
    console.log('[DEBUG] Final config state:');
    console.log('- Rules:', config.module.rules.length);
    console.log('- Externals type:', typeof config.externals);
    console.log('- Aliases:', Object.keys(config.resolve.alias || {}));

    return config;
  }
}

export default nextConfig 