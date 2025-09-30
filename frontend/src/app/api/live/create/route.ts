import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BodyIn = {
  // canonical
  system?: string
  length_minutes?: number
  max_players?: number
  new_player_friendly?: boolean
  is_18_plus?: boolean
  is_private?: boolean
  title?: string | null
  vibe?: string | null
  discord_url?: string | null
  game_url?: string | null
  poster_url?: string | null
  // aliases the UI might send
  length?: number // hours or minutes
  lengthHours?: number
  length_hours?: number
  seats?: number
  npf?: boolean
  adult?: boolean
  isPrivate?: boolean
  discord?: string | null
  vtt_url?: string | null
  vtt?: string | null
  photo_url?: string | null
  photo?: string | null
  image_url?: string | null
  image?: string | null
  poster?: string | null
}

function toBool(v: any): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

function normalizeLengthMinutes(raw: BodyIn): number | null {
  // Prefer explicit minutes first
  if (Number.isFinite(Number(raw.length_minutes))) return Number(raw.length_minutes)

  // Accept hours fields
  if (Number.isFinite(Number(raw.lengthHours))) return Math.round(Number(raw.lengthHours) * 60)
  if (Number.isFinite(Number(raw.length_hours))) return Math.round(Number(raw.length_hours) * 60)

  // If "length" looks like hours (< 24), treat as hours; else treat as minutes
  if (Number.isFinite(Number(raw.length))) {
    const n = Number(raw.length)
    if (n > 0 && n < 24) return Math.round(n * 60)
    return Math.round(n)
  }
  return null
}

function pickPoster(raw: BodyIn): string | null {
  return (
    raw.poster_url ??
    raw.photo_url ??
    raw.image_url ??
    raw.poster ??
    raw.photo ??
    raw.image ??
    null
  )
}

function pickDiscord(raw: BodyIn): string | null {
  return raw.discord_url ?? raw.discord ?? null
}

function pickGameLink(raw: BodyIn): string | null {
  return raw.game_url ?? raw.vtt_url ?? raw.vtt ?? null
}

export async function POST(req: Request) {
  try {
    // ----- Env guard: fail early with a clear message if anything is missing
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!URL || !ANON || !SERVICE) {
      return NextResponse.json(
        {
          step: 'env',
          error: 'missing_supabase_env',
          haveUrl: !!URL,
          haveAnon: !!ANON,
          haveService: !!SERVICE,
        },
        { status: 500 },
      )
    }

    // ----- Require a logged-in user (host) via their browser bearer
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ step: 'auth', error: 'Not authenticated' }, { status: 401 })
    }

    // User-scoped client to read user id
    const userClient = createClient(URL, ANON, { global: { headers: { Authorization: auth } } })
    const { data: userRes, error: uErr } = await userClient.auth.getUser()
    const user = userRes?.user
    if (uErr || !user) {
      return NextResponse.json({ step: 'auth', error: 'No user' }, { status: 401 })
    }

    // ----- Read & normalize payload
    const raw = (await req.json().catch(() => ({}))) as BodyIn

    const system = String(raw.system ?? '').trim()
    const lengthMin = normalizeLengthMinutes(raw)
    const npf = toBool(raw.new_player_friendly ?? raw.npf)
    const adult = toBool(raw.is_18_plus ?? raw.adult)
    const max = Math.max(1, Math.min(10, Number(raw.max_players ?? raw.seats ?? 6)))
    const isPrivate = toBool(raw.is_private ?? raw.isPrivate)

    const title = raw.title ?? null
    const vibe = raw.vibe ?? null
    const discord_url = pickDiscord(raw)
    const game_url = pickGameLink(raw)
    const poster_url = pickPoster(raw)

    if (!system || !Number.isFinite(lengthMin)) {
      return NextResponse.json({ step: 'validate', error: 'missing_fields' }, { status: 400 })
    }

    // ----- Service role client: performs writes (bypasses RLS)
    const admin = createClient(URL, SERVICE)

    // Ensure one open room per host: close any existing open first
    await admin
      .from('live_games')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('host_id', user.id)
      .eq('status', 'open')

    // Insert new open game
    const { data: inserted, error } = await admin
      .from('live_games')
      .insert({
        host_id: user.id,
        status: 'open',
        system,
        new_player_friendly: npf,
        is_18_plus: adult,
        length_minutes: lengthMin!,
        max_players: max,
        is_private: isPrivate,
      })
      .select('id')
      .single()

    if (error || !inserted?.id) {
      return NextResponse.json({ step: 'insert', error: error?.message || 'insert_failed' }, { status: 500 })
    }

    const gameId = inserted.id as string

    // Upsert room metadata expected by the lobby UI
    const { error: roomErr } = await admin
      .from('live_rooms')
      .upsert(
        {
          id: gameId,
          host_id: user.id,
          status: 'open',
          title,
          vibe,
          system,
          seats: max,
          length_min: lengthMin!,
          welcomes_new: npf,
          is_mature: adult,
          discord_url,
          game_url,
          poster_url,
        },
        { onConflict: 'id' },
      )

    if (roomErr) {
      return NextResponse.json({ step: 'rooms', error: roomErr.message }, { status: 500 })
    }

    // Ensure host appears in seat counts if your UI derives from live_game_players
    await admin
      .from('live_game_players')
      .upsert({ game_id: gameId, user_id: user.id }, { onConflict: 'game_id,user_id' })

    return NextResponse.json(
      { gameId, href: `/live/${gameId}?host=1` },
      { status: 200 },
    )
  } catch (e: any) {
    return NextResponse.json({ step: 'exception', error: e?.message || 'unknown' }, { status: 500 })
  }
}

// Optional: be explicit about non-POST
export async function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  })
}

