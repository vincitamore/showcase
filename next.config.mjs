/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
    // Enable server actions
    serverActions: true,
    // Enable module resolution features
    esmExternals: 'loose',
    // Optimize build performance
    turbotrace: {
      logLevel: 'error',
      contextDirectory: __dirname,
      processCwd: __dirname,
    },
    // Prevent excessive file tracing
    outputFileTracingRoot: __dirname,
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
        '.git/**/*',
        '**/*.{pem,pdf,txt,log,md}',
      ],
    },
  },
  webpack: (config, { isServer }) => {
    // Handle module resolution
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    return config;
  },
}

export default nextConfig 