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
    // Modify build trace options
    turbotrace: false
  },
  transpilePackages: ['twitter-api-v2'],
  output: 'standalone',
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
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
    // Add module resolution aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': '/vercel/path0/src'
    };
    return config;
  },
  // Reduce the impact of source maps
  productionBrowserSourceMaps: false
}

export default nextConfig 