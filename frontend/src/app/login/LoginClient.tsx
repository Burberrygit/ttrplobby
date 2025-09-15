// File: frontend/src/app/login/LoginClient.tsx
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [user, setUser] = useState<any>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  function redirectPostAuth() {
    const nextFromUrl = searchParams?.get('next')
    const nextFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') : null
    const dest = nextFromUrl || nextFromStorage || '/profile'
    if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')
    router.replace(dest)
  }

  useEffect(() => {
    const n = searchParams?.get('next')
    if (typeof window !== 'undefined' && n) sessionStorage.setItem('nextAfterLogin', n)

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) redirectPostAuth()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) redirectPostAuth()
    })
    return () => { sub.subscription.unsubscribe() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    setStatus(error ? error.message : 'Check your inbox for the sign-in link.')
  }

  async function handleOAuth(provider: 'google' | 'discord') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) setStatus(error.message)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Banner/header like landing page */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between relative z-50">
          <a href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ttrplobby logo" className="h-6 w-6 rounded" />
            <span className="font-bold text-lg tracking-tight">ttrplobby</span>
          </a>
        </div>
      </header>

      {/* Page content */}
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4">
        <div className="bg-zinc-900 p-6 rounded-xl shadow-xl w-full max-w-md">
          <h1 className="text-xl font-bold mb-4">Sign in to ttrplobby</h1>

          {user ? (
            <p>Signed in as {user.email}</p>
          ) : (
            <>
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700"
                  required
                  autoComplete="email"
                />
                <button
                  type="submit"
                  className="w-full px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 font-medium"
                >
                  Send magic link
                </button>
              </form>

              <div className="mt-4 space-y-2">
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

              {/* Small inline sign-up link */}
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

