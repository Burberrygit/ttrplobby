// File: frontend/src/app/api/auth/sync/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: 'missing_supabase_env' }, { status: 500 })
  }

  const { access_token, refresh_token } = await req.json().catch(() => ({}))
  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: 'missing_tokens' }, { status: 400 })
  }

  const jar = cookies()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return jar.getAll() },
      setAll(list) {
        try { list.forEach(({ name, value, options }) => jar.set(name, value, options)) } catch {}
      }
    }
  })

  // This sets the httpOnly SSR cookies (needs refresh_token!)
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 401 })

  return NextResponse.json({ ok: true, userId: data.user?.id ?? null })
}
