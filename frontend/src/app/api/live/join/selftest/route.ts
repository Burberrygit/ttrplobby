// File: frontend/src/app/api/live/join/selftest/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: 'missing_supabase_env', haveUrl: !!url, haveKey: !!key },
      { status: 500 }
    )
  }

  const jar = cookies()

  // Optional Bearer support for debugging
  const authHeader = req.headers.get('authorization')
  const accessToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : null

  const sb = createServerClient(url, key, {
    cookies: {
      getAll() { return jar.getAll() },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => jar.set(name, value, options)) } catch {}
      }
    },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined
  })

  try {
    const { data: { user }, error } = await sb.auth.getUser()
    return NextResponse.json({ ok: !!user && !error, userId: user?.id ?? null, error: error?.message ?? null, usedBearer: !!accessToken })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}

