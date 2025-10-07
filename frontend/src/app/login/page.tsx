// frontend/src/app/login/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { supabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import LoginClient from './LoginClient'

function safeNext(raw?: string) {
  if (!raw) return '/profile'
  try {
    const dec = decodeURIComponent(raw)
    return dec.startsWith('/') ? dec : '/profile'
  } catch {
    return '/profile'
  }
}

export default async function Page({ searchParams }: { searchParams?: { next?: string } }) {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const dest = safeNext(searchParams?.next)
  if (user) redirect(dest)
  return <LoginClient />
}
