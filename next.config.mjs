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
  transpilePackages: ['styled-jsx'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Remove styled-jsx from externals to bundle it
      const externals = [...config.externals];
      config.externals = externals.map((external) => {
        if (typeof external !== 'function') return external;
        return (ctx, req, cb) => {
          if (req.startsWith('styled-jsx')) {
            return cb();
          }
          return external(ctx, req, cb);
        };
      });
    }
    return config;
  }
}

export default nextConfig 