import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// NOTE: Adjust these table/column names to match your schema.
const GAMES_TABLE = 'live_games';
const PLAYERS_TABLE = 'live_game_players';
// Columns assumed on live_games: id (uuid), system (text), new_player_friendly (bool),
// adult (bool), length_minutes (int), status (text: 'open'|'full'|'started'),
// max_players (int), current_players (int? optional), created_at (timestamptz)

export async function POST(req: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // Must be logged in so we can add you as a player
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const system = (body.system ?? 'dnd5e') as string;
  const newPlayerFriendly = Boolean(body.newPlayerFriendly);
  const adult = Boolean(body.adult);
  const lengthMinutes = Number(body.lengthMinutes ?? 120);

  const tolerance = Number(body.toleranceMinutes ?? 0); // ±minutes
  const widen = Boolean(body.widen ?? false);
  const ignoreFlags = Boolean(body.ignoreFlags ?? false);

  const minLen = Math.max(15, lengthMinutes - tolerance);
  const maxLen = lengthMinutes + tolerance;

  // Build base query for open games of the chosen system with space
  // (If you track capacity differently, add your own condition here.)
  let query = supabase
    .from(GAMES_TABLE)
    .select('id, system, new_player_friendly, adult, length_minutes, status, max_players, created_at')
    .eq('status', 'open')
    .eq('system', system)
    .gte('length_minutes', minLen)
    .lte('length_minutes', maxLen)
    .order('created_at', { ascending: true })
    .limit(1);

  if (!ignoreFlags) {
    query = query.eq('new_player_friendly', newPlayerFriendly).eq('adult', adult);
  }

  // If not widening, keep strict match (no changes). When widening, the above already widens by length tolerance.
  const { data: games, error: gErr } = await query;
  if (gErr) {
    console.error('[quick-join] game search error', gErr);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  if (!games || games.length === 0) {
    return NextResponse.json({ error: 'No match' }, { status: 404 });
  }

  const game = games[0];

  // Add current user as player (id → your profiles/users FK as needed)
  // If your players table wants a profile_id (not auth user id), replace user.id accordingly.
  const insertPayload = { game_id: game.id, user_id: user.id };

  // Try upsert to avoid duplicate joins
  const { error: joinErr } = await supabase
    .from(PLAYERS_TABLE)
    .upsert(insertPayload, { onConflict: 'game_id,user_id', ignoreDuplicates: false });

  if (joinErr) {
    // If it's a uniqueness violation, treat as success (already joined).
    const msg = String(joinErr.message || '').toLowerCase();
    const isUnique = msg.includes('duplicate') || msg.includes('unique') || msg.includes('conflict');
    if (!isUnique) {
      console.error('[quick-join] join error', joinErr);
      return NextResponse.json({ error: 'Join failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ gameId: game.id });
}
