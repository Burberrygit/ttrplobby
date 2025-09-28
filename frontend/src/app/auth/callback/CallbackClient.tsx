// File: frontend/src/app/auth/callback/CallbackClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const CANON = 'www.ttrplobby.com'

export default function CallbackClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    let mounted = true
    let timeout: ReturnType<typeof setTimeout> | null = null

    // 0) Enforce canonical host before letting the SDK parse the URL
    if (typeof window !== 'undefined' && window.location.hostname !== CANON) {
      const { protocol, pathname, search } = window.location
      window.location.replace(`${protocol}//${CANON}${pathname}${search}`)
      return
    }

    const nextFromQuery = sp.get('next') || undefined
    const nextFromStorage =
      typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') || undefined : undefined
    const intended = nextFromQuery || nextFromStorage || '/profile'

    ;(async () => {
      try {
        // 1) If the SDK already parsed the URL and we have a session, redirect.
        const first = await supabase.auth.getSession()
        if (!mounted) return
        if (first.data.session) {
          if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')
          router.replace(intended)
          return
        }

        // 2) Wait briefly for the SDK to finish parsing; then decide.
        timeout = setTimeout(async () => {
          if (!mounted) return
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')
            router.replace(intended)
            return
          }
          // 3) No session even after parsing -> go back to login with `next`.
          setStatus('No auth data found in URL. Returning to login…')
          router.replace(`/login?next=${encodeURIComponent(intended)}`)
        }, 700)

        // Also listen for auth state changes in case parsing finishes sooner.
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
          if (!mounted) return
          if (s?.user) {
            if (timeout) clearTimeout(timeout)
            if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')
            router.replace(intended)
          }
        })

        return () => {
          sub.subscription.unsubscribe()
        }
      } catch (e: any) {
        setStatus(e?.message || 'Unexpected error. Returning to login…')
        router.replace(`/login?next=${encodeURIComponent(intended)}`)
      }
    })()

    return () => {
      mounted = false
      if (timeout) clearTimeout(timeout)
    }
  }, [router, sp])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="bg-zinc-900 p-6 rounded-xl shadow-xl w-full max-w-md text-center">
        <p className="text-sm">{status}</p>
        <p className="text-xs text-zinc-400 mt-2">If this screen persists, try a private window.</p>
      </div>
    </div>
  )
}


