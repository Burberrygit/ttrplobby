'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    setStatus(error ? error.message : 'Check your inbox for the sign-in link.')
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
                className="w-full px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700"
              >
                Continue with Google
              </button>
              <button
                onClick={()=>handleOAuth('discord')}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700"
              >
                Continue with Discord
              </button>
            </div>
          </>
        )}

        <p className="text-sm text-zinc-400 mt-4">{status}</p>
      </div>
    </div>
  )
}
