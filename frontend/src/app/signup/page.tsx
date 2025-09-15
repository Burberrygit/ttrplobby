'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function SignupPage() {
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
    // If someone linked here with ?next=…, keep it for roundtrip
    const n = searchParams?.get('next')
    if (typeof window !== 'undefined' && n) {
      sessionStorage.setItem('nextAfterLogin', n)
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) redirectPostAuth()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) redirectPostAuth()
    })
    return () => { sub.subscription.unsubscribe() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault()
    // Magic link also creates the account
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    setStatus(error ? error.message : 'Check your inbox to finish creating your account.')
  }

  async function handleOAuth(provider: 'google' | 'discord') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    })
    if (error) setStatus(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="bg-zinc-900 p-6 rounded-xl shadow-xl w-full max-w-md">
        <h1 className="text-xl font-bold mb-4">Create your ttrplobby account</h1>

        {user ? (
          <p>Signed in as {user.email}</p>
        ) : (
          <>
            <form onSubmit={handleEmailSignup} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700"
                required
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
                Sign up with Google
              </button>
              <button
                onClick={()=>handleOAuth('discord')}
                className="w-full px-3 py-2 rounded-md bg-[#5865F2] hover:bg-[#4752C4] text-white"
              >
                Sign up with Discord
              </button>
            </div>

            <p className="text-sm text-zinc-400 mt-4">
              Already have an account? <a href="/login" className="text-emerald-400 hover:text-emerald-300">Log in</a>
            </p>
          </>
        )}

        <p className="text-sm text-zinc-400 mt-4">{status}</p>
      </div>
    </div>
  )
}
