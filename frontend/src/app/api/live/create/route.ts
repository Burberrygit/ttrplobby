import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;   // safe for browser, used here to read user
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;       // server-only, NEVER expose

export async function POST(req: Request) {
  try {
    // 1) Require a logged-in user (host) via their browser bearer
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ step: 'auth', error: 'Not authenticated' }, { status: 401 });
    }

    // Use a user-scoped client just to get the user id
    const userClient = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return NextResponse.json({ step: 'auth', error: 'No user' }, { status: 401 });
    }

    // 2) Read payload
    const body = await req.json().catch(() => ({}));
    const system  = String(body.system || '');
    const length  = Number(body.length_minutes ?? body.length);
    const npf     = !!body.new_player_friendly;
    const adult   = !!body.is_18_plus;
    const max     = Number(body.max_players ?? 6);
    const priv    = !!body.is_private;

    if (!system || !Number.isFinite(length)) {
      return NextResponse.json({ step: 'validate', error: 'missing_fields' }, { status: 400 });
    }

    // 3) Use SERVICE role to write (bypasses RLS; allowed on server only)
    const admin = createClient(URL, SERVICE);

    // (Optional) Ensure one open room per host: close any existing open first
    await admin
      .from('live_games')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('host_id', user.id)
      .eq('status', 'open');

    // 4) Insert new open lobby
    const { data, error } = await admin
      .from('live_games')
      .insert({
        host_id: user.id,
        status: 'open',
        system,
        new_player_friendly: npf,
        is_18_plus: adult,
        length_minutes: length,
        max_players: max,
        is_private: priv,
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ step: 'insert', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gameId: data.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ step: 'exception', error: e?.message || 'unknown' }, { status: 500 });
  }
}
