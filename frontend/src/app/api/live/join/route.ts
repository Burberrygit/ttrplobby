// frontend/src/app/api/live/join/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { system=null, newbie=null, adult=null, length=null } = body ?? {}

  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: gameId, error } = await supabase.rpc('match_and_join_live_game', {
    p_system: system,
    p_newbie: newbie,
    p_adult: adult,
    p_length: length,
    p_discoverable_only: true
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!gameId) return NextResponse.json({ error: 'no_game_found' }, { status: 404 })

  return NextResponse.json({ gameId })
}
