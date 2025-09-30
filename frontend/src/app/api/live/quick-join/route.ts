import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type Body = {
  system: string
  npf?: boolean
  adult?: boolean
  length: number            // desired length in minutes
  toleranceMinutes?: number // optional, default 0 (strict)
}

export async function POST(req: Request) {
  try {
    // --- Auth: must be logged in; we use the user's bearer so auth.uid() is set ---
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ step: 'auth', error: 'Not authenticated' }, { status: 401 })
    }
    if (!URL || !KEY) {
      return NextResponse.json({ step: 'env', error: 'missing_supabase_env' }, { status: 500 })
    }

    const supabase = createClient(URL, KEY, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: uErr } = await supabase.auth.getUser()
    if (uErr || !user) {
      return NextResponse.json({ step: 'auth', error: 'No user' }, { status: 401 })
    }

    // --- Input normalization ---
    const body = (await req.json().catch(() => ({}))) as Partial<Body>
    if (typeof body.system !== 'string' || !body.system.trim()) {
      return NextResponse.json({ step: 'validate', error: 'missing_system' }, { status: 400 })
    }
    if (!Number.isFinite(body.length)) {
      return NextResponse.json({ step: 'validate', error: 'missing_length' }, { status: 400 })
    }

    const system = body.system.trim()
    const desiredLen = Math.max(15, Number(body.length))
    const tol = Number.isFinite(body.toleranceMinutes) ? Math.max(0, Number(body.toleranceMinutes)) : 0
    const minLen = desiredLen - tol
    const maxLen = desiredLen + tol
    const npf = !!body.npf
    const adult = !!body.adult

    // --- MATCH OPEN PUBLIC GAMES (NO INSERTS HERE) ---
    let q = supabase
      .from('live_games')
      .select(
        'id, host_id, status, is_private, system, new_player_friendly, is_18_plus, length_minutes, max_players, created_at'
      )
      .eq('status', 'open')
      .eq('is_private', false)
      .eq('system', system)          // strict system match
      .neq('host_id', user.id)       // never join your own lobby
      .gte('length_minutes', minLen)
      .lte('length_minutes', maxLen)
      .order('created_at', { ascending: true })
      .limit(25)

    if (npf === true)    q = q.eq('new_player_friendly', true)
    if (adult === false) q = q.eq('is_18_plus', false)

    const { data: games, error: selErr } = await q
    if (selErr) {
      return NextResponse.json({ step: 'match', error: selErr.message }, { status: 500 })
    }
    if (!games || games.length === 0) {
      return NextResponse.json({ step: 'match', error: 'no_game_found' }, { status: 404 })
    }

    // --- TRY TO JOIN ATOMICALLY (one-by-one) VIA RPC ---
    // Requires you created the Postgres function:
    //   create or replace function public.join_live_game(p_game_id uuid) ... (locks row, checks capacity, inserts me)
    for (const g of games) {
      const { data: ok, error: joinErr } = await supabase.rpc('join_live_game', { p_game_id: g.id })
      if (!joinErr && ok) {
        return NextResponse.json({ gameId: g.id }, { status: 200 })
      }
      const msg = String(joinErr?.message || '').toLowerCase()
      if (msg.includes('game_full') || msg.includes('game_not_open')) {
        // try next candidate
        continue
      }
      // unexpected db error
      return NextResponse.json({ step: 'join', error: joinErr?.message || 'join_failed' }, { status: 500 })
    }

    // All candidates full or not open by the time we tried
    return NextResponse.json({ step: 'join', error: 'no_seat_found' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ step: 'exception', error: e?.message || 'unknown' }, { status: 500 })
  }
}

export async function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  })
}

