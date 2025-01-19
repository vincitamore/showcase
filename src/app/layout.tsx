import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { NavBar } from "@/components/nav-bar"
import { Analytics } from "@vercel/analytics/react"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Vincit Amore | Portfolio",
  description: "Building technology that empowers and endures",
  metadataBase: new URL('https://amore.build'),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
    ],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vincit Amore",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://amore.build',
    siteName: 'Vincit Amore',
    title: 'Vincit Amore | Portfolio',
    description: 'Building technology that empowers and endures',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Vincit Amore Portfolio'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vincit Amore | Portfolio',
    description: 'Building technology that empowers and endures',
    images: ['/og-image.png'],
    creator: '@yourusername'
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative flex min-h-screen flex-col">
            <NavBar />
            {children}
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
} 