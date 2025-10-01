import './globals.css'
import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ttrplobby.com'),
  title: {
    default: 'TTRPLobby - Find & Host TTRPG Games',
    template: '%s | TTRPLobby',
  },
  description: 'Find a table now or schedule for later.',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.png' },
    ],
  },
  alternates: {
    canonical: '/',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-zinc-950">
      <body className="min-h-screen">
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
