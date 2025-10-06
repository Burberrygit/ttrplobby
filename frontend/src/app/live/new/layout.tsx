import type { Metadata } from 'next'

export const metadata: Metadata = {
  // De-emphasize this builder page in search results
  robots: { index: false, follow: true },
  alternates: { canonical: '/live/new' },
}

export default function LiveNewLayout({ children }: { children: React.ReactNode }) {
  // Simple pass-through layout so we can host route-level metadata on the server
  return children
}
