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
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
    turbotrace: {
      logLevel: 'error',
      contextDirectory: '.',
      processCwd: '.',
      memoryLimit: 4096,
    },
    outputFileTracingRoot: '.',
    outputFileTracingIncludes: {
      '/**': ['./node_modules/twitter-api-v2/**/*'],
    },
    outputFileTracingExcludes: {
      '/**': [
        '**/node_modules/!(twitter-api-v2)/**/*',
        '**/.git/**',
        '**/.next/**',
      ],
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig 