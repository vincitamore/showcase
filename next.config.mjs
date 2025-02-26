/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'abs.twimg.com',
        port: '',
        pathname: '/sticky/default_profile_images/**',
      },
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'amore.build',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    scrollRestoration: true,
  },
}

export default nextConfig 