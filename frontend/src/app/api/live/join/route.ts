// frontend/src/app/api/live/join/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function supa() {
  const jar = cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return jar.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            jar.set(name, value, options)
          })
        } catch {
          // If called from a Server Component context, setting may be disallowed—ignore.
        }
      }
    }
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const system = body?.system ?? null
  const newbie = typeof body?.newbie === 'boolean' ? body.newbie : null
  const adult  = typeof body?.adult  === 'boolean' ? body.adult  : null
  const length = Number.isFinite(+body?.length) ? Number(body.length) : null

  const sb = supa()
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ step: 'auth', error: authErr?.message || 'unauthenticated' }, { status: 401 })
  }

  const { data: gameId, error } = await sb.rpc('match_and_join_live_game', {
    p_system: system,
    p_newbie: newbie,
    p_adult: adult,
    p_length: length,
    p_discoverable_only: true
  })

  if (error)   return NextResponse.json({ step: 'rpc',   error: error.message }, { status: 400 })
  if (!gameId) return NextResponse.json({ step: 'match', error: 'no_game_found' }, { status: 404 })
  return NextResponse.json({ gameId })
}
