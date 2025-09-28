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

        if (!code) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('nextAfterLogin')
            router.replace(intended)
            return
          }
          router.replace(`/login?next=${encodeURIComponent(intended)}`)
          return
        }

        const { error } = await supabase.auth.exchangeCodeForSession(href)
        if (error) {
          setStatus(error.message)
          setTimeout(() => router.replace(`/login?next=${encodeURIComponent(intended)}`), 1200)
          return
        }

        const { data: userData } = await supabase.auth.getUser()
        const uid = userData.user?.id

        // Optional: check onboarding
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


