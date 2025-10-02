// File: frontend/src/app/layout.tsx
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
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png', sizes: '48x48' },
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: [{ url: '/logo.png' }],
    shortcut: [{ url: '/logo.png' }],
  },
  openGraph: {
    type: 'website',
    url: 'https://www.ttrplobby.com',
    title: 'TTRPLobby - Find & Host TTRPG Games',
    description:
      'ttrplobby lets you find a TTRPG game online in minutes or plan your next campaign. Create an account with Google, or Discord, build your profile, and join a lobby instantly.',
    images: [{ url: '/logo.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TTRPLobby — Find & Host TTRPG Games',
    description:
      'ttrplobby lets you find a TTRPG game online in minutes or plan your next campaign. Create an account with Google, or Discord, build your profile, and join a lobby instantly.',
    images: ['/logo.png'],
  },
  alternates: {
    canonical: '/',
  },
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


