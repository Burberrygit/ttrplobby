import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // ----- Env guard: fail early with a clear message if anything is missing
    const URL     = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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
      );
    }

    // ----- Require a logged-in user (host) via their browser bearer
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) {
      return NextResponse.json({ step: 'auth', error: 'Not authenticated' }, { status: 401 });
    }

    // User-scoped client to read user id
    const userClient = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return NextResponse.json({ step: 'auth', error: 'No user' }, { status: 401 });
    }

    // ----- Read & validate payload
    const raw = await req.json().catch(() => ({} as any));
    const system  = String(raw.system ?? '').trim();
    const length  = Number.isFinite(Number(raw.length_minutes ?? raw.length))
      ? Number(raw.length_minutes ?? raw.length)
      : NaN;
    const npf     = !!raw.new_player_friendly;
    const adult   = !!raw.is_18_plus;
    const max     = Math.max(1, Math.min(10, Number(raw.max_players ?? 6)));
    const priv    = !!raw.is_private;

    if (!system || !Number.isFinite(length)) {
      return NextResponse.json({ step: 'validate', error: 'missing_fields' }, { status: 400 });
    }

    // ----- Service role client: performs writes (bypasses RLS)
    const admin = createClient(URL, SERVICE);

    // Ensure one open room per host: close any existing open first
    await admin
      .from('live_games')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('host_id', user.id)
      .eq('status', 'open');

    // Insert new open lobby
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

// Optional: be explicit about non-POST
export async function GET() {
  return new NextResponse('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  });
}
