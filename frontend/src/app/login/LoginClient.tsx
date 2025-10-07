// File: frontend/src/app/login/LoginClient.tsx
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const CANON = 'www.ttrplobby.com'
const BASE = `https://${CANON}`

export default function LoginClient() {
  const [status, setStatus] = useState('')
  const [user, setUser] = useState<any>(null)
  const [didKick, setDidKick] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  function safePath(candidate: string | null | undefined) {
    if (!candidate) return '/profile'
    try {
      const decoded = decodeURIComponent(candidate)
      return decoded.startsWith('/') ? decoded : '/profile'
    } catch {
      return '/profile'
    }
  }

  function redirectPostAuth() {
    if (didKick) return
    const nextFromUrl = searchParams?.get('next')
    const nextFromStorage =
      typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') : null
    const dest = safePath(nextFromUrl || nextFromStorage || '/profile')

    if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')

    // Try client-side navigation first
    try {
      router.replace(dest)
    } catch {}

    // Hard fallback to guarantee we leave /login even if the router is stale
    if (typeof window !== 'undefined') {
      setDidKick(true)
      setTimeout(() => {
        // If we're still on /login, force a navigation
        if (location.pathname.startsWith('/login')) {
          location.assign(dest)
        }
      }, 60)
    }
  }

  useEffect(() => {
    // Enforce canonical host before kicking off any auth
    if (typeof window !== 'undefined' && window.location.hostname !== CANON) {
      const { protocol, pathname, search } = window.location
      window.location.replace(`${protocol}//${CANON}${pathname}${search}`)
      return
    }

    const n = searchParams?.get('next')
    if (typeof window !== 'undefined' && n) {
      sessionStorage.setItem('nextAfterLogin', n)
    }

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) redirectPostAuth()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) redirectPostAuth()
    })
    return () => { sub.subscription.unsubscribe() }
  }, [searchParams, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOAuth(provider: 'google' | 'discord') {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('nextAfterLogin')) {
      sessionStorage.setItem('nextAfterLogin', window.location.pathname + window.location.search)
    }
    const next =
      searchParams?.get('next') ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') || '' : '')
    const redirect = next
      ? `${BASE}/auth/callback?next=${encodeURIComponent(safePath(next))}`
      : `${BASE}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirect }
    })
    if (error) setStatus(error.message)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between relative z-50">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ttrplobby logo" className="h-6 w-6 rounded" />
            <span className="font-bold text-lg tracking-tight">ttrplobby</span>
          </a>
        </div>
      </header>

      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4">
        <div className="bg-zinc-900 p-6 rounded-xl shadow-xl w-full max-w-md">
          <h1 className="text-xl font-bold mb-4">Sign in to ttrplobby</h1>

          {user ? (
            <p>Redirecting…</p>
          ) : (
            <>
              <div className="mt-2 space-y-2">
                <button
                  onClick={()=>handleOAuth('google')}
                  className="w-full px-3 py-2 rounded-md bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-200"
                >
                  Continue with Google
                </button>
                <button
                  onClick={()=>handleOAuth('discord')}
                  className="w-full px-3 py-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white"
                >
                  Continue with Discord
                </button>
              </div>

              <p className="text-sm text-zinc-400 mt-4">
                Need an account?{' '}
                <a href="/signup" className="text-emerald-400 hover:text-emerald-300">Sign up</a>
              </p>

              <p className="text-xs text-zinc-400 mt-4">
                By continuing, you agree to our <a className="underline hover:text-zinc-200" href="/terms">Terms</a> and <a className="underline hover:text-zinc-200" href="/privacy">Privacy</a>.
              </p>
            </>
          )}

          <p className="text-sm text-zinc-400 mt-4">{status}</p>
        </div>
      </div>
    </div>
  )
}

