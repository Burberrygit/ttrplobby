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

  const authHeader = req.headers.get('authorization')
  const accessToken =
    authHeader && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : null

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: 'missing_bearer' }, { status: 400 })
  }

  const jar = cookies()
  const sb = createServerClient(url, key, {
    cookies: {
      getAll() { return jar.getAll() },
      setAll(toSet) {
        try { toSet.forEach(({ name, value, options }) => jar.set(name, value, options)) } catch {}
      }
    },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  })

  // Touch session; SSR helper will set cookies via setAll()
  const { data: { user }, error } = await sb.auth.getUser()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 401 })
  return NextResponse.json({ ok: true, userId: user?.id ?? null })
}
