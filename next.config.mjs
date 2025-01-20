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
    // Disable all experimental features
    esmExternals: false,
  },
  transpilePackages: ['twitter-api-v2'],
  output: 'standalone',
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      aggregateTimeout: 5,
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.next/**',
      ],
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
      };
    }
    // Optimize bundle size
    config.optimization = {
      ...config.optimization,
      minimize: true,
    };
    return config;
  },
  // Reduce the impact of source maps
  productionBrowserSourceMaps: false,
  // Modify build trace options
  experimental: {
    turbotrace: {
      logLevel: 'error',
      logDetail: true,
      memoryLimit: 4096
    }
  }
}

export default nextConfig 