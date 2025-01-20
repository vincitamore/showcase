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
    },
    outputFileTracingRoot: '.',
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
        '.git/**/*',
        '**/*.{pem,pdf,txt,log,md}',
        '**/cache/**',
      ],
    },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig 