'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function CallbackClient() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    let mounted = true
    let timeout: ReturnType<typeof setTimeout> | null = null
    const url = new URL(window.location.href)
    const nextFromQuery = url.searchParams.get('next') || undefined
    const nextFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') || undefined : undefined
    const intended = nextFromQuery || nextFromStorage || '/profile'

    ;(async () => {
      try {
        // 1) See if the SDK already parsed the URL and we have a session.
        const first = await supabase.auth.getSession()
        if (!mounted) return
        if (first.data.session) {
          sessionStorage.removeItem('nextAfterLogin')
          router.replace(intended)
          return
        }

        // 2) Wait briefly for the SDK to finish parsing; then decide.
        timeout = setTimeout(async () => {
          if (!mounted) return
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            sessionStorage.removeItem('nextAfterLogin')
            router.replace(intended)
            return
          }
          // 3) No session even after parsing -> go back to login with `next`.
          setStatus('No auth data found in URL. Returning to login…')
          router.replace(`/login?next=${encodeURIComponent(intended)}`)
        }, 600)

        // Also listen for auth state changes in case parsing finishes sooner.
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
          if (!mounted) return
          if (s?.user) {
            if (timeout) clearTimeout(timeout)
            sessionStorage.removeItem('nextAfterLogin')
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
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="bg-zinc-900 p-6 rounded-xl shadow-xl w-full max-w-md text-center">
        <p className="text-sm">{status}</p>
        <p className="text-xs text-zinc-400 mt-2">If this screen persists, try a private window.</p>
      </div>
    </div>
  )
}

