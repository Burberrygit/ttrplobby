import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Body = {
  system: string;
  npf?: boolean;
  adult?: boolean;
  length: number;            // in minutes
  toleranceMinutes?: number; // optional, default 0 (strict)
};

export async function POST(req: Request) {
  try {
    // ----- Auth (must be logged in; join uses user token so RLS applies) -----
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ step: 'auth', error: 'Not authenticated' }, { status: 401 });
    }
    const supabase = createClient(URL, KEY, { global: { headers: { Authorization: auth } } });

    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !user) {
      return NextResponse.json({ step: 'auth', error: 'No user' }, { status: 401 });
    }

    // ----- Input -----
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    if (!body.system || typeof body.length !== 'number' || !Number.isFinite(body.length)) {
      return NextResponse.json({ step: 'validate', error: 'missing_fields' }, { status: 400 });
    }
    const npf   = !!body.npf;
    const adult = !!body.adult;
    const tol   = Number.isFinite(body.toleranceMinutes)
      ? Math.max(0, Number(body.toleranceMinutes))
      : 0; // strict by default

    const minLen = Math.max(15, body.length - tol);
    const maxLen = body.length + tol;

    // ----- MATCH ONLY (NO INSERTS) -----
    let q = supabase
      .from('live_games')
      .select('id, host_id, status, is_private, system, new_player_friendly, is_18_plus, length_minutes, max_players, created_at')
      .eq('status', 'open')
      .eq('is_private', false)
      .eq('system', body.system)        // strict system match
      .neq('host_id', user.id)          // never seat into your own lobby
      .gte('length_minutes', minLen)
      .lte('length_minutes', maxLen)
      .order('created_at', { ascending: true })
      .limit(10);

    // Preferences
    if (npf === true)    q = q.eq('new_player_friendly', true);
    if (adult === false) q = q.eq('is_18_plus', false);

    const { data: games, error: selErr } = await q;
    if (selErr) {
      return NextResponse.json({ step: 'match', error: selErr.message }, { status: 500 });
    }
    if (!games || games.length === 0) {
      return NextResponse.json({ step: 'match', error: 'no_game_found' }, { status: 404 });
    }

    // Pick first
    const game = games[0];

    // ----- SEAT (upsert membership) -----
    const { error: seatErr } = await supabase
      .from('live_game_players')
      .upsert({ game_id: game.id, user_id: user.id }, { onConflict: 'game_id,user_id', ignoreDuplicates: true });

    if (seatErr) {
      return NextResponse.json({ step: 'join', error: seatErr.message }, { status: 500 });
    }

    return NextResponse.json({ gameId: game.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ step: 'exception', error: e?.message || 'unknown' }, { status: 500 });
  }
}

