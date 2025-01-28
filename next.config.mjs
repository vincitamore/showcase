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
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
      }
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Performance optimizations
  optimizeFonts: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    },
    optimizePackageImports: ['lucide-react'],
    scrollRestoration: true,
  },

  // Font optimization
  fontLoaders: [
    { loader: '@next/font/google', options: { subsets: ['latin'] } }
  ],
  
  // Monitoring and logging
  logging: {
    fetches: {
      fullUrl: true,
    },
    level: process.env.NODE_ENV === 'development' ? 'info' : 'error',
  },
  
  // Error tracking
  productionBrowserSourceMaps: true,
  
  // Build optimization
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Development configuration
    if (dev && !isServer) {
      config.devtool = 'eval-source-map';
    }
    
    // Production optimization
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    return config;
  }
}

export default nextConfig; 