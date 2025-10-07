// frontend/src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

function safeNext(raw: string | null): string {
  if (!raw) return '/profile'
  try {
    const dec = decodeURIComponent(raw)
    return dec.startsWith('/') ? dec : '/profile'
  } catch {
    return '/profile'
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  const supabase = supabaseServer() // uses your SSR cookie adapter :contentReference[oaicite:0]{index=0}

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      // Couldn’t create a session → bounce to /login with next
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, url.origin))
    }
  }

  // Always strip ?code from the URL and move on
  return NextResponse.redirect(new URL(next, url.origin))
}
