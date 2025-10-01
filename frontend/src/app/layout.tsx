import './globals.css'

export const metadata = {
  title: 'TTRPLobby - Find & Host TTRPG Games',
  description: 'Find a table now or schedule for later.',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: [
      { url: '/logo.png' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-zinc-950">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
