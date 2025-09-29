// frontend/src/app/api/live/join/selftest/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookies().get(n)?.value } as any }
  )
  const { data: { user }, error } = await sb.auth.getUser()
  return NextResponse.json({ ok: !!user && !error, userId: user?.id ?? null, error: error?.message ?? null })
}
