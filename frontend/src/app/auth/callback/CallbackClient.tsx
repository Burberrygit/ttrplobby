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

        const destFromQuery = url.searchParams.get('next') || undefined
        const destFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') || undefined : undefined
        const intended = destFromQuery || destFromStorage || '/profile'

        console.debug('[callback] code?', !!code, 'intended:', intended)

        if (!code) {
          const { data: { session } } = await supabase.auth.getSession()
          console.debug('[callback] no code, session?', !!session)
          if (session?.user) {
            sessionStorage.removeItem('nextAfterLogin')
            router.replace(intended)
            return
          }
          setStatus('No auth code in URL and no active session. Returning to login…')
          setTimeout(() => router.replace(`/login?next=${encodeURIComponent(intended)}`), 1500)
          return
        }

        const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(href)
        console.debug('[callback] exchange result:', { error, user: exchangeData?.user?.id })
        if (error) {
          setStatus(`Auth exchange failed: ${error.message}`)
          setTimeout(() => router.replace(`/login?next=${encodeURIComponent(intended)}`), 2500)
          return
        }

        const { data: sess } = await supabase.auth.getSession()
        console.debug('[callback] post-exchange session?', !!sess.session)
        if (!sess.session) {
          setStatus('No session after exchange (PKCE/cookies mismatch). Returning to login…')
          setTimeout(() => router.replace(`/login?next=${encodeURIComponent(intended)}`), 2500)
          return
        }

        // Optional: onboarding gate
        let destination = intended
        const uid = sess.session.user.id
        const { data: prof } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', uid)
          .maybeSingle()
        if (!prof?.username) destination = '/onboarding'

        sessionStorage.removeItem('nextAfterLogin')
        setStatus('Signed in. Taking you to your destination…')
        setTimeout(() => router.replace(destination), 300)
      } catch (e: any) {
        console.error('[callback] unexpected error', e)
        setStatus(e?.message || 'Unexpected error. Returning to login…')
        setTimeout(() => router.replace('/login'), 2500)
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="bg-zinc-900 p-6 rounded-xl shadow-xl w-full max-w-md text-center">
        <p className="text-sm">{status}</p>
        <p className="text-xs text-zinc-400 mt-2">Tip: open DevTools Console for detailed logs (prefix “[callback]”).</p>
      </div>
    </div>
  )
}
