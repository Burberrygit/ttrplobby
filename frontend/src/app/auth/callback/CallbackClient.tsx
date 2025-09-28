'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function CallbackClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    (async () => {
      try {
        const href = window.location.href
        const url = new URL(href)
        const code = url.searchParams.get('code')

        // Compute intended destination early
        const nextFromQuery = url.searchParams.get('next') || undefined
        const nextFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') || undefined : undefined
        const fallback = '/profile'
        const intended = nextFromQuery || nextFromStorage || fallback

        // If no ?code= in the URL, don't call exchange — either we already have a
        // session (refresh/back button), or the user hit the route directly.
        if (!code) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')
            router.replace(intended)
            return
          }
          // No session and no code -> bounce to login, keep `next`
          router.replace(`/login?next=${encodeURIComponent(intended)}`)
          return
        }

        // First-time, real callback: exchange code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(href)
        if (error) {
          setStatus(error.message)
          setTimeout(() => router.replace(`/login?next=${encodeURIComponent(intended)}`), 1200)
          return
        }

        // Defensive: ensure a profiles row exists for first-time users
        const { data: userData } = await supabase.auth.getUser()
        const uid = userData.user?.id
        if (uid) {
          await supabase.from('profiles').upsert({ id: uid })
        }

        // Decide final destination (onboarding if no username yet)
        let destination = intended
        if (uid) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', uid)
            .maybeSingle()
          if (!prof?.username) destination = '/onboarding'
        }

        if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')
        router.replace(destination)
      } catch (e: any) {
        setStatus(e?.message || 'Unexpected error')
        setTimeout(() => router.replace('/login'), 1200)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="bg-zinc-900 p-6 rounded-xl shadow-xl w-full max-w-md text-center">
        <p className="text-sm">{status}</p>
      </div>
    </div>
  )
}

