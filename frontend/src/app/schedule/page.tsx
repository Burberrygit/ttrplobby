// File: frontend/src/app/schedule/page.tsx
import { Suspense } from 'react'
import SearchClient from './SearchClient'

// Force dynamic rendering and disable cache (must be on a Server Component)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SchedulePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-white">
      {/* Header: Left = ttrplobby pill, Right = Profile button */}
      <div className="mb-4 flex items-center justify-between">
        <TopBanner />
        <a
          href="/profile"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
        >
          <LogoIcon />
          <span className="font-semibold">Profile</span>
        </a>
      </div>

      <Suspense
        fallback={
          <div className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
        }
      >
        <SearchClient />
      </Suspense>
    </div>
  )
}

function TopBanner() {
  return (
    <a
      href="/"
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:border-white/30 transition"
    >
      <LogoIcon />
      <span className="font-semibold">ttrplobby</span>
    </a>
  )
}

function LogoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}


