// File: frontend/src/app/auth/callback/CallbackClient.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const CANON = 'www.ttrplobby.com'

// safe sessionStorage helpers
const sget = (k: string) => { try { return window.sessionStorage.getItem(k) } catch { return null } }
const sdel = (k: string) => { try { window.sessionStorage.removeItem(k) } catch {} }

// Route users who haven’t completed their profile to this page:
const SETUP_ROUTE = '/profile/edit'

export default function CallbackClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    let mounted = true
    let timeout: ReturnType<typeof setTimeout> | null = null

    // Force canonical host & preserve hash (tokens can arrive in #)
    if (typeof window !== 'undefined' && window.location.hostname !== CANON) {
      const { protocol, pathname, search, hash } = window.location
      window.location.replace(`${protocol}//${CANON}${pathname}${search}${hash || ''}`)
      return
    }

    const nextFromQuery   = sp?.get('next') || undefined
    const nextFromStorage = typeof window !== 'undefined' ? sget('nextAfterLogin') || undefined : undefined
    const intended        = nextFromQuery || nextFromStorage || '/profile'

    async function go() {
      // 1) If session already present, proceed
      const first = await supabase.auth.getSession()
      if (!mounted) return

      // If not present, try exchanging ?code=… as a fallback
      if (!first.data.session) {
        const href = typeof window !== 'undefined' ? window.location.href : ''
        const hasCode = /[?#]code=/.test(href)
        if (hasCode) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(href)
          if (!mounted) return
          if (error) {
            setStatus('Could not complete sign-in. Returning to login…')
            router.replace(`/login?next=${encodeURIComponent(intended)}`)
            return
          }
        } else {
          // Give the SDK a moment to parse tokens that may be in #fragment
          await new Promise(r => { timeout = setTimeout(r, 700) })
        }
      }

      // 2) Now we should have a session; fetch profile & decide destination
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setStatus('No auth session found. Returning to login…')
        router.replace(`/login?next=${encodeURIComponent(intended)}`)
        return
      }

      // Load their profile
      const { data: prof, error } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('id', session.user.id)
        .maybeSingle()

      if (error) {
        // Fail open to login if profile fetch fails
        setStatus('Could not load profile. Returning to login…')
        router.replace(`/login?next=${encodeURIComponent(intended)}`)
        return
      }

      // 3) Route: if missing basics, go to setup; else go to intended
      const needsSetup = !prof || !prof.username || !prof.display_name
      sdel('nextAfterLogin')
      router.replace(needsSetup ? SETUP_ROUTE : intended)
    }

    go()

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

