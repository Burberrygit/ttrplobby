import './globals.css'
import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ttrplobby.com'),
  title: {
    default: 'TTRPLobby - Find & Host TTRPG Games',
    template: '%s | TTRPLobby',
  },
  description:
    'ttrplobby lets you find a TTRPG game online in minutes or plan your next campaign. Create an account with Google, or Discord, build your profile, and join a lobby instantly.',
  alternates: {
    canonical: '/', // Prefer the homepage for brand queries
  },
  openGraph: {
    type: 'website',
    url: 'https://www.ttrplobby.com/',
    siteName: 'TTRPLobby',
    title: 'TTRPLobby - Find & Host TTRPG Games',
    description:
      'Start a live lobby or join one in minutes. D&D 5e, PF2e, and more.',
    images: [
      // Ensure this exists in /public (1200×630 recommended). If not, it will fall back to logo.png below.
      { url: '/og-image.png', width: 1200, height: 630, alt: 'TTRPLobby — Find & Host TTRPG Games' },
      { url: '/logo.png', width: 512, height: 512, alt: 'TTRPLobby Logo' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TTRPLobby — Find & Host TTRPG Games',
    description:
      'Start a live lobby or join one in minutes. D&D 5e, PF2e, and more.',
    images: ['/og-image.png', '/logo.png'],
  },
  icons: {
    // Favicon & icons (Google favicons prefer ≥48×48 and a stable URL)
    icon: [
      { url: '/favicon.ico' },                          // multi-size ICO
      { url: '/icon.svg', type: 'image/svg+xml' },     // optional SVG
      { url: '/icon-192.png', sizes: '192x192' },      // Android/Chrome
      { url: '/icon-512.png', sizes: '512x512' },      // PWA large icon
      { url: '/logo.png?v=2', type: 'image/png' },     // fallback
    ],
    apple: [{ url: '/apple-touch-icon.png' }],         // 180×180 recommended
    shortcut: [{ url: '/favicon.ico' }],
  },
  themeColor: '#0b0f19',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-zinc-950">
      <body className="min-h-screen">
        {/* Google tag (GA4) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-C32E0WWFGN"
          strategy="afterInteractive"
        />
        <Script id="ga4" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-C32E0WWFGN');
          `}
        </Script>

        {/* Structured data to help Google display your brand logo */}
        <Script
          id="ld-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "TTRPLobby",
              "url": "https://www.ttrplobby.com",
              "logo": "https://www.ttrplobby.com/logo.png"
            })
          }}
        />
        <Script
          id="ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "TTRPLobby",
              "url": "https://www.ttrplobby.com/"
            })
          }}
        />
        {children}
      </body>
    </html>
  )
}

