// File: frontend/src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function safeNext(raw: string | null): string {
  if (!raw) return '/profile'
  let dec = raw
  try { dec = decodeURIComponent(raw) } catch {}
  // Only allow same-site internal paths, and never bounce back to /login or /auth/*
  if (!dec.startsWith('/')) return '/profile'
  if (dec.startsWith('/login') || dec.startsWith('/auth')) return '/profile'
  return dec
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const supabase = supabaseServer()

  if (code) {
    // Exchange the OAuth code for a session (writes cookies via Next's cookies() adapter)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // If we failed to set a session, send the user back to /login (with a safe next)
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin))
    }
  }

  // Always strip ?code from the URL and move on to a safe internal destination
  return NextResponse.redirect(new URL(next, url.origin))
}
