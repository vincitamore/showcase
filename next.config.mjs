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
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Disable client-side debug mode in development
      config.devtool = 'eval-source-map';
    }
    return config;
  }
}

export default nextConfig; 