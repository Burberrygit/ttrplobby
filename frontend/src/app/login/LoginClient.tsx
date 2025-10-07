// File: frontend/src/app/login/LoginClient.tsx
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const CANON = 'www.ttrplobby.com'
const BASE = `https://${CANON}`

function sanitizeNext(candidate: string | null | undefined): string {
  if (!candidate) return '/profile'
  let dec = candidate
  try { dec = decodeURIComponent(candidate) } catch {}
  if (!dec.startsWith('/')) return '/profile'
  // Never allow looping back to the auth pages
  if (dec.startsWith('/login') || dec.startsWith('/auth')) return '/profile'
  return dec
}

export default function LoginClient() {
  const [status, setStatus] = useState('')
  const [user, setUser] = useState<any>(null)
  const [didKick, setDidKick] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  function redirectPostAuth() {
    if (didKick) return
    const dest = sanitizeNext(searchParams?.get('next') || '/profile')

    // try soft nav first
    try { router.replace(dest) } catch {}
    // hard fallback to guarantee leaving /login
    if (typeof window !== 'undefined') {
      setDidKick(true)
      setTimeout(() => {
        if (location.pathname.startsWith('/login')) location.assign(dest)
      }, 60)
    }
  }

  useEffect(() => {
    // Ensure canonical host
    if (typeof window !== 'undefined' && window.location.hostname !== CANON) {
      const { protocol, pathname, search } = window.location
      window.location.replace(`${protocol}//${CANON}${pathname}${search}`)
      return
    }

    // If already logged in, bounce away immediately
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) redirectPostAuth()
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) redirectPostAuth()
    })
    return () => { sub.subscription.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function handleOAuth(provider: 'google' | 'discord') {
    // Compute a safe "next" for after the callback
    const fromUrl = searchParams?.get('next')
    const fromRef =
      typeof document !== 'undefined' && document.referrer.startsWith(`https://${CANON}`)
        ? new URL(document.referrer).pathname + new URL(document.referrer).search
        : null

    const next = sanitizeNext(fromUrl || fromRef || '/profile')
    const redirect = `${BASE}/auth/callback?next=${encodeURIComponent(next)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirect },
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
                  onClick={() => handleOAuth('google')}
                  className="w-full px-3 py-2 rounded-md bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-200"
                >
                  Continue with Google
                </button>
                <button
                  onClick={() => handleOAuth('discord')}
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

