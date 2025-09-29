import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const jar = cookies()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return jar.getAll() },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => jar.set(name, value, options)) } catch {}
      }
    }
  })

  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  // Handles email magic links & OAuth PKCE
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    // Redirect to home (or a dashboard) after cookie is set
    return NextResponse.redirect(new URL('/', origin))
  }

  return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 })
}
