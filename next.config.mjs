/** @type {import('next').NextConfig} */
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
    serverComponentsExternalPackages: ['twitter-api-v2'],
    // Disable build traces collection which is causing the stack overflow
    outputFileTracingIncludes: {},
    outputFileTracingExcludes: {
      '**': [
        'node_modules/**/*',
        '.git/**/*',
        '.next/**/*',
        'build/**/*',
        'dist/**/*',
      ],
    },
  },
}

export default nextConfig 