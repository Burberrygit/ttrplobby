export const dynamic = 'force-dynamic'
export const revalidate = 0

'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
    (async () => {
      try {
        // Finalize the login by exchanging the code in the URL for a session
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
        if (error) {
          setStatus(error.message)
          setTimeout(() => router.replace('/login'), 1500)
          return
        }
        // Send the user where they intended to go
        const nextFromUrl = searchParams?.get('next')
        const nextFromStorage = typeof window !== 'undefined' ? sessionStorage.getItem('nextAfterLogin') : null
        const dest = nextFromUrl || nextFromStorage || '/profile'
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
