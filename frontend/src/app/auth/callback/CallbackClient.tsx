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
        // Exchange the code in the URL for a session
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error) {
          setStatus(error.message)
          setTimeout(() => router.replace('/login'), 1500)
          return
        }

        // Decide destination: onboarding if profile incomplete, else next/profile
        const { data: userData } = await supabase.auth.getUser()
        const uid = userData.user?.id
        let destFromQuery = searchParams?.get('next') || undefined
        let destFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') || undefined : undefined

        let needsOnboarding = false
        if (uid) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', uid)
            .maybeSingle()
          needsOnboarding = !prof?.username
        }

        const dest = needsOnboarding
          ? '/onboarding'
          : (destFromQuery || destFromStorage || '/profile')

        if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')
        router.replace(dest)
      } catch (e: any) {
        setStatus(e?.message || 'Unexpected error')
        setTimeout(() => router.replace('/login'), 1500)
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

