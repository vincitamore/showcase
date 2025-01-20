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
  webpack: (config) => {
    config.watchOptions = {
      aggregateTimeout: 5,
      ignored: ['**/.git/**', '**/node_modules/**'],
    };
    return config;
  },
}

export default nextConfig 