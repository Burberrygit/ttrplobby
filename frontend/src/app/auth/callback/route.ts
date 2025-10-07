// File: frontend/src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function safeNext(raw: string | null): string {
  if (!raw) return '/profile'
  let decoded = ''
  try { decoded = decodeURIComponent(raw) } catch { decoded = raw }
  return decoded.startsWith('/') ? decoded : '/profile'
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const next = safeNext(url.searchParams.get('next'))

  const supabase = supabaseServer()
  // Reads ?code=... from the URL and sets the auth cookies via Next's cookie store.
  const { error } = await supabase.auth.exchangeCodeForSession(req.url)

  // Always leave this URL (don’t leave the code in history).
  if (error) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
