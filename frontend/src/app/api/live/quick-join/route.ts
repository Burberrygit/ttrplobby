// File: frontend/src/app/api/live/quick-join/route.ts
// API: POST /api/live/quick-join
// Body may include: { system, newPlayerFriendly, newbie, npf, adult, length, lengthMinutes, toleranceMinutes, widen, ignoreFlags }
// The client should send Authorization: Bearer <access_token>

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Env (set in Netlify and GH Actions secrets)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

// Tables / columns
const GAMES_TABLE = 'live_games'
const PLAYERS_TABLE = 'live_game_players'
const COL_NEWBIE = 'new_player_friendly'
const COL_ADULT  = 'is_18_plus'          // <-- matches your schema
const COL_LEN    = 'length_minutes'

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json({ step: 'env', error: 'missing_supabase_env' }, { status: 500 })
    }

    // Require Bearer
    const authHeader = req.headers.get('authorization') || ''
    const hasBearer = /^Bearer\s+/i.test(authHeader)
    if (!hasBearer) {
      return NextResponse.json({ step: 'auth', error: 'Not authenticated' }, { status: 401 })
    }

    // Supabase client which forwards the Bearer to respect RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, detectSessionInUrl: false },
      global: { headers: { Authorization: authHeader } },
    })

    // Confirm user
    const { data: userData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !userData?.user) {
      return NextResponse.json({ step: 'auth', error: authErr?.message || 'Not authenticated' }, { status: 401 })
    }
    const user = userData.user

    const body = await req.json().catch(() => ({} as any))

    // Accept multiple parameter names from different callers
    const system = (body.system ?? null) as string | null
    const newPlayerFriendly =
      typeof body.newPlayerFriendly === 'boolean' ? body.newPlayerFriendly
      : typeof body.newbie === 'boolean' ? body.newbie
      : typeof body.npf === 'boolean' ? body.npf
      : null

    const adult =
      typeof body.adult === 'boolean' ? body.adult : null

    const lengthMinutes =
      Number.isFinite(+body.length) ? Number(body.length)
      : Number.isFinite(+body.lengthMinutes) ? Number(body.lengthMinutes)
      : null

    const tolerance = Number.isFinite(+body.toleranceMinutes) ? Number(body.toleranceMinutes) : 0
    const ignoreFlags = Boolean(body.ignoreFlags ?? false)

    const minLen = lengthMinutes == null ? null : Math.max(15, lengthMinutes - tolerance)
    const maxLen = lengthMinutes == null ? null : lengthMinutes + tolerance

    // Build the query
    let query = supabase
      .from(GAMES_TABLE)
      .select(`id, system, ${COL_NEWBIE}, ${COL_ADULT}, ${COL_LEN}, status, max_players, created_at`)
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(1)

    if (system) query = query.eq('system', system)
    if (minLen != null) query = query.gte(COL_LEN, minLen)
    if (maxLen != null) query = query.lte(COL_LEN, maxLen)
    if (!ignoreFlags) {
      if (newPlayerFriendly != null) query = query.eq(COL_NEWBIE, newPlayerFriendly)
      if (adult != null)            query = query.eq(COL_ADULT, adult)
    }

    const { data: games, error: gErr } = await query
    if (gErr) {
      return NextResponse.json(
        { step: 'search', error: gErr.message, code: gErr.code, details: (gErr as any).details, hint: (gErr as any).hint },
        { status: 500 }
      )
    }
    if (!games || games.length === 0) {
      return NextResponse.json({ step: 'match', error: 'no_game_found' }, { status: 404 })
    }

    const game = games[0]

    // Upsert membership (safe idempotent join)
    const { error: joinErr } = await supabase
      .from(PLAYERS_TABLE)
      .upsert({ game_id: game.id, user_id: user.id }, { onConflict: 'game_id,user_id', ignoreDuplicates: false })

    if (joinErr) {
      const msg = String(joinErr.message || '').toLowerCase()
      const isUnique = msg.includes('duplicate') || msg.includes('unique') || msg.includes('conflict')
      if (!isUnique) {
        return NextResponse.json(
          { step: 'join', error: joinErr.message, code: joinErr.code, details: (joinErr as any).details, hint: (joinErr as any).hint },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ gameId: game.id })
  } catch (e: any) {
    return NextResponse.json({ step: 'server', error: String(e?.message || e) }, { status: 500 })
  }
}
