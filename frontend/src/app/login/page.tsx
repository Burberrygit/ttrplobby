// File: frontend/src/app/login/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import LoginClient from './LoginClient'

function safeNext(raw?: string) {
  if (!raw) return '/profile'
  let dec = raw
  try { dec = decodeURIComponent(raw) } catch {}
  // Only allow internal paths that are not auth pages
  if (!dec.startsWith('/')) return '/profile'
  if (dec.startsWith('/login') || dec.startsWith('/auth')) return '/profile'
  return dec
}

export default async function Page({ searchParams }: { searchParams?: { next?: string } }) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const dest = safeNext(searchParams?.next)
  if (user) {
    // Already logged in → never show the login page; go somewhere safe
    redirect(dest)
  }

  // Not signed in → render client UI (buttons call OAuth)
  return <LoginClient />
}
