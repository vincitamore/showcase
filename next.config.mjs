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
    esmExternals: 'loose',
    // Enable server actions and components
    serverActions: true,
    serverComponents: true,
    // Ensure styled-jsx is properly handled
    externalDir: true,
    // Disable build traces collection
    outputFileTracingRoot: undefined,
    outputFileTracingExcludes: {
      '*': [
        'node_modules/**/*',
        '**/*.json',
        '**/*.d.ts'
      ]
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
  // Ensure Next.js includes styled-jsx in the server bundle
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias['styled-jsx'] = require.resolve('styled-jsx');
      config.resolve.alias['styled-jsx/package.json'] = require.resolve('styled-jsx/package.json');
    }
    return config;
  }
}

export default nextConfig 