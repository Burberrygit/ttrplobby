// API: POST /api/live/quick-join
// Body may include: { system, newPlayerFriendly, adult, lengthMinutes, toleranceMinutes, widen, ignoreFlags }
// The user must send an Authorization: Bearer <access_token> header (set by the client in /live/search).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Ensure these are set in your Netlify env:
// NEXT_PUBLIC_SUPABASE_URL
// NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Adjust to your schema
const GAMES_TABLE = 'live_games'
const PLAYERS_TABLE = 'live_game_players'

export async function POST(req: Request) {
  // Expect Authorization header with a Supabase access token
  const authHeader = req.headers.get('authorization') || ''
  const hasBearer = /^Bearer\s+/i.test(authHeader)
  if (!hasBearer) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader } },
  })

  // Confirm user
  const { data: userData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !userData?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const user = userData.user

  const body = await req.json().catch(() => ({}))
  const system = (body.system ?? 'dnd5e') as string
  const newPlayerFriendly = Boolean(body.newPlayerFriendly)
  const adult = Boolean(body.adult)
  const lengthMinutes = Number(body.lengthMinutes ?? 120)

  const tolerance = Number(body.toleranceMinutes ?? 0)
  const widen = Boolean(body.widen ?? false) // retained for compatibility; not used separately
  const ignoreFlags = Boolean(body.ignoreFlags ?? false)

  const minLen = Math.max(15, lengthMinutes - tolerance)
  const maxLen = lengthMinutes + tolerance

  // Base query
  let query = supabase
    .from(GAMES_TABLE)
    .select('id, system, new_player_friendly, adult, length_minutes, status, max_players, created_at')
    .eq('status', 'open')
    .eq('system', system)
    .gte('length_minutes', minLen)
    .lte('length_minutes', maxLen)
    .order('created_at', { ascending: true })
    .limit(1)

  if (!ignoreFlags) {
    query = query.eq('new_player_friendly', newPlayerFriendly).eq('adult', adult)
  }

  const { data: games, error: gErr } = await query
  if (gErr) {
    console.error('[quick-join] search error', gErr)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
  if (!games || games.length === 0) {
    return NextResponse.json({ error: 'No match' }, { status: 404 })
  }

  const game = games[0]

  // Join or upsert player
  const insertPayload = { game_id: game.id, user_id: user.id }
  const { error: joinErr } = await supabase
    .from(PLAYERS_TABLE)
    .upsert(insertPayload, { onConflict: 'game_id,user_id', ignoreDuplicates: false })

  if (joinErr) {
    const msg = String(joinErr.message || '').toLowerCase()
    const isUnique = msg.includes('duplicate') || msg.includes('unique') || msg.includes('conflict')
    if (!isUnique) {
      console.error('[quick-join] join error', joinErr)
      return NextResponse.json({ error: 'Join failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ gameId: game.id })
}
